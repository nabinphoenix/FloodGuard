from __future__ import annotations

from decimal import Decimal
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException, status

from config import settings


TABLE_NAME = "SensorReadings"

dynamodb = boto3.resource(
    "dynamodb",
    region_name=settings.aws_region,
    aws_access_key_id=settings.aws_access_key_id,
    aws_secret_access_key=settings.aws_secret_access_key,
)
table = dynamodb.Table(TABLE_NAME)


def _to_decimal(value: float | int) -> Decimal:
    return Decimal(str(value))


def _from_dynamo(item: dict[str, Any] | None) -> dict[str, Any] | None:
    if item is None:
        return None

    converted = dict(item)
    if isinstance(converted.get("water_level"), Decimal):
        converted["water_level"] = float(converted["water_level"])
    return converted


def save_reading(station_id: str, timestamp: str, water_level: float, district: str) -> dict[str, Any]:
    item = {
        "station_id": station_id,
        "timestamp": timestamp,
        "water_level": _to_decimal(water_level),
        "district": district,
    }

    try:
        table.put_item(Item=item)
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not save sensor reading to DynamoDB.",
        ) from exc

    return _from_dynamo(item) or {}


def get_latest_reading(station_id: str) -> dict[str, Any] | None:
    try:
        response = table.query(
            KeyConditionExpression=Key("station_id").eq(station_id),
            ScanIndexForward=False,
            Limit=1,
        )
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not fetch latest sensor reading from DynamoDB.",
        ) from exc

    items = response.get("Items", [])
    return _from_dynamo(items[0]) if items else None


def get_station_history(station_id: str, limit: int = 48) -> list[dict[str, Any]]:
    bounded_limit = max(1, min(limit, 200))

    try:
        response = table.query(
            KeyConditionExpression=Key("station_id").eq(station_id),
            ScanIndexForward=False,
            Limit=bounded_limit,
        )
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not fetch sensor history from DynamoDB.",
        ) from exc

    items = [_from_dynamo(item) for item in response.get("Items", [])]
    return [item for item in reversed(items) if item is not None]


def get_all_latest() -> list[dict[str, Any]]:
    latest_by_station: dict[str, dict[str, Any]] = {}
    scan_kwargs: dict[str, Any] = {}

    try:
        while True:
            response = table.scan(**scan_kwargs)
            for item in response.get("Items", []):
                station_id = item["station_id"]
                current_latest = latest_by_station.get(station_id)
                if current_latest is None or item["timestamp"] > current_latest["timestamp"]:
                    latest_by_station[station_id] = item

            last_key = response.get("LastEvaluatedKey")
            if not last_key:
                break
            scan_kwargs["ExclusiveStartKey"] = last_key
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not fetch latest readings from DynamoDB.",
        ) from exc

    return [
        _from_dynamo(item) or {}
        for item in sorted(latest_by_station.values(), key=lambda reading: reading["station_id"])
    ]
