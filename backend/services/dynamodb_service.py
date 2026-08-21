from __future__ import annotations

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from config import settings


dynamodb_client = boto3.client(
    "dynamodb",
    region_name=settings.aws_region,
)


def sensor_store_health() -> dict[str, str]:
    """Check an existing configured DynamoDB table without creating resources.

    The current application schema stores sensor readings in RDS. This helper
    exposes an explicit status when a deployment also provides an existing
    DynamoDB table, instead of silently pretending a local fallback exists.
    """

    table_name = settings.dynamodb_sensor_table_name.strip()
    if not table_name:
        return {
            "status": "not_configured",
            "detail": "No DynamoDB sensor table is configured; RDS sensor_readings is canonical.",
        }

    try:
        response = dynamodb_client.describe_table(TableName=table_name)
        table_status = response.get("Table", {}).get("TableStatus", "unknown").lower()
        return {
            "status": "healthy" if table_status == "active" else table_status,
            "detail": f"Existing table: {table_name}",
        }
    except (BotoCoreError, ClientError):
        return {
            "status": "unavailable",
            "detail": f"Could not reach existing table: {table_name}",
        }
