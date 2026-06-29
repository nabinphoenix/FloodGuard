import json
import os
from datetime import datetime, timezone
from typing import Any

import boto3


sns_client = boto3.client("sns")
cloudwatch_client = boto3.client("cloudwatch")

SNS_TOPIC_ARN = os.environ["SNS_TOPIC_ARN"]
METRIC_NAMESPACE = os.environ.get("METRIC_NAMESPACE", "FloodGuard")


def parse_record_body(record: dict[str, Any]) -> dict[str, Any]:
    body = record.get("body", "{}")
    if isinstance(body, str):
        return json.loads(body)
    if isinstance(body, dict):
        return body
    raise ValueError("SQS record body must be JSON.")


def get_alert_level(water_level: float, warning_threshold: float, danger_threshold: float) -> str | None:
    if water_level >= danger_threshold:
        return "emergency"
    if water_level >= warning_threshold:
        return "warning"
    return None


def publish_alert(reading: dict[str, Any], alert_level: str) -> str:
    station_id = str(reading["station_id"])
    station_name = str(reading.get("name") or station_id)
    district = str(reading["district"])
    water_level = float(reading["water_level"])
    timestamp = str(reading.get("timestamp") or datetime.now(timezone.utc).isoformat())

    subject = f"FloodGuard {alert_level.upper()} Sensor Alert - {district}"[:100]
    message = (
        "FloodGuard Automatic Sensor Alert\n\n"
        f"Station: {station_name} ({station_id})\n"
        f"District: {district}\n"
        f"Alert level: {alert_level.upper()}\n"
        f"Water level: {water_level:.2f} m\n"
        f"Warning threshold: {float(reading['warning_threshold']):.2f} m\n"
        f"Danger threshold: {float(reading['danger_threshold']):.2f} m\n"
        f"Timestamp: {timestamp}\n\n"
        "This alert was triggered automatically from live sensor data."
    )

    response = sns_client.publish(
        TopicArn=SNS_TOPIC_ARN,
        Subject=subject,
        Message=message,
        MessageAttributes={
            "station_id": {"DataType": "String", "StringValue": station_id},
            "district": {"DataType": "String", "StringValue": district},
            "alert_level": {"DataType": "String", "StringValue": alert_level},
            "source": {"DataType": "String", "StringValue": "sensor_sqs_lambda"},
        },
    )
    return response["MessageId"]


def put_metric(count: int) -> None:
    if count <= 0:
        return

    cloudwatch_client.put_metric_data(
        Namespace=METRIC_NAMESPACE,
        MetricData=[
            {
                "MetricName": "AutoAlertTriggered",
                "Value": count,
                "Unit": "Count",
                "Timestamp": datetime.now(timezone.utc),
            }
        ],
    )


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    triggered_alerts = []
    failed_records = []

    for record in event.get("Records", []):
        message_id = record.get("messageId", "unknown")

        try:
            reading = parse_record_body(record)
            water_level = float(reading["water_level"])
            warning_threshold = float(reading["warning_threshold"])
            danger_threshold = float(reading["danger_threshold"])
            alert_level = get_alert_level(water_level, warning_threshold, danger_threshold)

            if alert_level:
                sns_message_id = publish_alert(reading, alert_level)
                triggered_alerts.append(
                    {
                        "sqs_message_id": message_id,
                        "sns_message_id": sns_message_id,
                        "station_id": reading["station_id"],
                        "alert_level": alert_level,
                    }
                )
        except Exception as exc:
            failed_records.append({"itemIdentifier": message_id})
            print(f"Failed to process SQS record {message_id}: {exc}")

    put_metric(len(triggered_alerts))

    result = {
        "statusCode": 200,
        "processed_records": len(event.get("Records", [])),
        "triggered_alerts": triggered_alerts,
        "failed_records": failed_records,
    }

    if failed_records:
        result["batchItemFailures"] = failed_records

    return result
