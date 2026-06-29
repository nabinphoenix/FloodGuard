import json
import os
from datetime import datetime, timezone
from typing import Any
from urllib.parse import unquote_plus

import boto3


sqs_client = boto3.client("sqs")
cloudwatch_client = boto3.client("cloudwatch")

ADMIN_REVIEW_QUEUE_URL = os.environ["ADMIN_REVIEW_QUEUE_URL"]
METRIC_NAMESPACE = os.environ.get("METRIC_NAMESPACE", "FloodGuard")


def s3_url(bucket: str, key: str) -> str:
    return f"https://{bucket}.s3.amazonaws.com/{key}"


def put_metric(count: int) -> None:
    if count <= 0:
        return

    cloudwatch_client.put_metric_data(
        Namespace=METRIC_NAMESPACE,
        MetricData=[
            {
                "MetricName": "ReportsProcessed",
                "Value": count,
                "Unit": "Count",
                "Timestamp": datetime.now(timezone.utc),
            }
        ],
    )


def send_admin_review_message(bucket: str, key: str, event_time: str | None) -> str:
    timestamp = event_time or datetime.now(timezone.utc).isoformat()
    payload = {
        "event_type": "report_photo_uploaded",
        "bucket": bucket,
        "key": key,
        "s3_url": s3_url(bucket, key),
        "timestamp": timestamp,
    }

    response = sqs_client.send_message(
        QueueUrl=ADMIN_REVIEW_QUEUE_URL,
        MessageBody=json.dumps(payload),
        MessageAttributes={
            "event_type": {"DataType": "String", "StringValue": "report_photo_uploaded"},
            "bucket": {"DataType": "String", "StringValue": bucket},
        },
    )
    return response["MessageId"]


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    processed = []

    for record in event.get("Records", []):
        bucket = record["s3"]["bucket"]["name"]
        key = unquote_plus(record["s3"]["object"]["key"])
        event_time = record.get("eventTime")
        sqs_message_id = send_admin_review_message(bucket, key, event_time)
        processed.append(
            {
                "bucket": bucket,
                "key": key,
                "s3_url": s3_url(bucket, key),
                "sqs_message_id": sqs_message_id,
            }
        )

    put_metric(len(processed))

    return {
        "statusCode": 200,
        "processed_count": len(processed),
        "processed": processed,
    }
