import json
import os
from datetime import datetime, timezone
from typing import Any

import boto3


sns_client = boto3.client("sns")
cloudwatch_client = boto3.client("cloudwatch")

SNS_TOPIC_ARN = os.environ["SNS_TOPIC_ARN"]
METRIC_NAMESPACE = os.environ.get("METRIC_NAMESPACE", "FloodGuard")


def response(status_code: int, body: dict[str, Any]) -> dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "OPTIONS,POST",
        },
        "body": json.dumps(body),
    }


def parse_body(event: dict[str, Any]) -> dict[str, Any]:
    body = event.get("body", {})

    if event.get("isBase64Encoded"):
        raise ValueError("Base64 encoded request bodies are not supported.")

    if isinstance(body, str):
        return json.loads(body or "{}")

    if isinstance(body, dict):
        return body

    raise ValueError("Request body must be a JSON object.")


def validate_payload(payload: dict[str, Any]) -> tuple[str, str, str]:
    district = str(payload.get("district", "")).strip()
    alert_level = str(payload.get("alert_level", "")).strip().lower()
    message = str(payload.get("message", "")).strip()

    if not district:
        raise ValueError("district is required.")
    if alert_level not in {"safe", "watch", "warning", "emergency"}:
        raise ValueError("alert_level must be safe, watch, warning, or emergency.")
    if not message:
        raise ValueError("message is required.")

    return district, alert_level, message


def put_metric() -> None:
    cloudwatch_client.put_metric_data(
        Namespace=METRIC_NAMESPACE,
        MetricData=[
            {
                "MetricName": "AlertsBroadcast",
                "Value": 1,
                "Unit": "Count",
                "Timestamp": datetime.now(timezone.utc),
            }
        ],
    )


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return response(200, {"message": "OK"})

    try:
        district, alert_level, message = validate_payload(parse_body(event))
    except (json.JSONDecodeError, ValueError) as exc:
        return response(400, {"error": str(exc)})

    subject = f"FloodGuard {alert_level.upper()} Alert - {district}"[:100]
    sns_message = (
        "FloodGuard Early Warning Alert\n\n"
        f"District: {district}\n"
        f"Alert level: {alert_level.upper()}\n"
        f"Message: {message}\n\n"
        "Please follow local authority instructions and stay safe."
    )

    sns_response = sns_client.publish(
        TopicArn=SNS_TOPIC_ARN,
        Subject=subject,
        Message=sns_message,
        MessageAttributes={
            "district": {"DataType": "String", "StringValue": district},
            "alert_level": {"DataType": "String", "StringValue": alert_level},
            "source": {"DataType": "String", "StringValue": "api_gateway_lambda"},
        },
    )
    put_metric()

    return response(
        200,
        {
            "message": "Alert broadcast successfully.",
            "sns_message_id": sns_response["MessageId"],
        },
    )
