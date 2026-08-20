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



def send_sensor_reading(reading_dict: dict[str, Any]) -> str:
    payload = {
        "event_type": "sensor_reading",
        "event_version": 1,
        "reading": reading_dict,
    }
    return _send_message(settings.sqs_sensor_queue_url, payload)
