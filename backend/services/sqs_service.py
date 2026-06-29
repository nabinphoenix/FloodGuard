from __future__ import annotations

import json
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException, status

from config import settings


sqs_client = boto3.client(
    "sqs",
    region_name=settings.aws_region,
    aws_access_key_id=settings.aws_access_key_id,
    aws_secret_access_key=settings.aws_secret_access_key,
)


def _json_default(value: Any) -> str | float:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return str(value)


def _send_message(queue_url: str, payload: dict[str, Any]) -> str:
    try:
        response = sqs_client.send_message(
            QueueUrl=queue_url,
            MessageBody=json.dumps(payload, default=_json_default),
        )
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not send message to SQS.",
        ) from exc

    return response["MessageId"]


def notify_admin_new_report(report_id: int, district: str, severity: int) -> str:
    payload = {
        "event_type": "new_incident_report",
        "report_id": report_id,
        "district": district,
        "severity": severity,
        "created_at": datetime.now(timezone.utc),
    }
    return _send_message(settings.sqs_admin_queue_url, payload)


def send_sensor_reading(reading_dict: dict[str, Any]) -> str:
    payload = {
        "event_type": "sensor_reading",
        "reading": reading_dict,
        "received_at": datetime.now(timezone.utc),
    }
    return _send_message(settings.sqs_sensor_queue_url, payload)


def receive_sensor_messages(max_messages: int = 10) -> list[dict[str, Any]]:
    bounded_max = max(1, min(max_messages, 10))

    try:
        response = sqs_client.receive_message(
            QueueUrl=settings.sqs_sensor_queue_url,
            MaxNumberOfMessages=bounded_max,
            WaitTimeSeconds=5,
            VisibilityTimeout=30,
            MessageAttributeNames=["All"],
            AttributeNames=["All"],
        )
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not receive messages from SQS.",
        ) from exc

    messages = []
    for message in response.get("Messages", []):
        body = message.get("Body", "{}")
        try:
            parsed_body = json.loads(body)
        except json.JSONDecodeError:
            parsed_body = body

        messages.append(
            {
                "message_id": message.get("MessageId"),
                "receipt_handle": message.get("ReceiptHandle"),
                "body": parsed_body,
                "attributes": message.get("Attributes", {}),
                "message_attributes": message.get("MessageAttributes", {}),
            }
        )

    return messages


def delete_message(receipt_handle: str) -> None:
    try:
        sqs_client.delete_message(
            QueueUrl=settings.sqs_sensor_queue_url,
            ReceiptHandle=receipt_handle,
        )
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not delete SQS message.",
        ) from exc
