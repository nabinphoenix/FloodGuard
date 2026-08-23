import json
import os
from datetime import datetime, timezone
from typing import Any

import boto3


sns_client = boto3.client("sns")
cloudwatch_client = boto3.client("cloudwatch")

SNS_TOPIC_ARN = os.environ["SNS_TOPIC_ARN"]
METRIC_NAMESPACE = os.environ.get("METRIC_NAMESPACE", "FloodGuard")
STATUS_SEVERITY = {
    "no_data": -1,
    "safe": 0,
    "watch": 1,
    "warning": 2,
    "emergency": 3,
}
CURRENT_STATUSES = {"safe", "watch", "warning", "emergency"}


def _required_text(reading: dict[str, Any], field: str) -> str:
    value = reading.get(field)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"Sensor reading field '{field}' is required.")
    return value.strip()


def _status(value: Any, field: str, *, allow_no_data: bool = False) -> str:
    if not isinstance(value, str):
        raise ValueError(f"Sensor reading field '{field}' must be a status string.")
    normalized = value.strip().lower()
    allowed = CURRENT_STATUSES | ({"no_data"} if allow_no_data else set())
    if normalized not in allowed:
        raise ValueError(f"Sensor reading field '{field}' has an invalid status.")
    return normalized


def _number(reading: dict[str, Any], field: str) -> float:
    try:
        return float(reading[field])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError(f"Sensor reading field '{field}' must be numeric.") from exc


def _first_present(reading: dict[str, Any], *fields: str) -> Any:
    for field in fields:
        if field in reading and reading[field] is not None:
            return reading[field]
    return None


def normalize_sensor_reading(reading: dict[str, Any]) -> dict[str, Any]:
    """Validate the canonical v2 event and accept v1 aliases still in SQS.

    Canonical producer schema uses ``current_status``, ``previous_status`` and
    ``recorded_at``. The aliases only protect in-flight v1 queue messages; new
    producers must send the canonical names.
    """

    if not isinstance(reading, dict):
        raise ValueError("Sensor event reading must be an object.")

    current_status = _status(
        _first_present(reading, "current_status", "current_alert_level", "status"),
        "current_status",
    )
    previous_status = _status(
        _first_present(reading, "previous_status", "previous_alert_level"),
        "previous_status",
        allow_no_data=True,
    )
    recorded_at = _first_present(reading, "recorded_at", "timestamp")
    if not isinstance(recorded_at, str) or not recorded_at.strip():
        raise ValueError("Sensor reading field 'recorded_at' is required.")

    return {
        "station_id": _required_text(reading, "station_id"),
        "station_code": _required_text(reading, "station_code"),
        "station_name": _required_text(
            {**reading, "station_name": _first_present(reading, "station_name", "name")},
            "station_name",
        ),
        "province": reading.get("province"),
        "district": _required_text(reading, "district"),
        "river_basin": reading.get("river_basin"),
        "river_name": reading.get("river_name"),
        "water_level": _number(reading, "water_level"),
        "current_status": current_status,
        "previous_status": previous_status,
        "watch_threshold": _number(reading, "watch_threshold"),
        "warning_threshold": _number(reading, "warning_threshold"),
        "danger_threshold": _number(reading, "danger_threshold"),
        "recorded_at": recorded_at.strip(),
        "source": reading.get("source", "unknown"),
    }


def parse_record_body(record: dict[str, Any]) -> dict[str, Any]:
    body_str = record.get("body", "{}")
    if isinstance(body_str, str):
        envelope = json.loads(body_str)
    elif isinstance(body_str, dict):
        envelope = body_str
    else:
        raise ValueError("SQS record body must be JSON.")

    if envelope.get("event_type") != "sensor_reading":
        raise ValueError(f"Unknown event type: {envelope.get('event_type')}")

    return normalize_sensor_reading(envelope.get("reading", {}))


def should_trigger_alert(previous_status: str, current_status: str) -> bool:
    """Match FloodGuard's transition rules without repeated-state alerts."""

    if current_status == "safe":
        return previous_status in {"warning", "emergency"}
    return STATUS_SEVERITY[current_status] > STATUS_SEVERITY[previous_status]


def publish_alert(reading: dict[str, Any], current_status: str) -> str:
    station_id = str(reading["station_id"])
    station_code = str(reading["station_code"])
    station_name = str(reading["station_name"])
    district = str(reading["district"])
    water_level = float(reading["water_level"])
    timestamp = str(reading["recorded_at"])

    is_recovery = current_status == "safe"
    subject = (
        f"FloodGuard Sensor Recovery - {district}"
        if is_recovery
        else f"FloodGuard {current_status.upper()} Sensor Alert - {district}"
    )[:100]
    transition = "Recovery status: SAFE" if is_recovery else f"Alert level: {current_status.upper()}"
    message = (
        "FloodGuard Automatic Sensor Alert\n\n"
        f"Station: {station_name} ({station_code})\n"
        f"District: {district}\n"
        f"{transition}\n"
        f"Water level: {water_level:.2f} m\n"
        f"Watch threshold: {float(reading['watch_threshold']):.2f} m\n"
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
            "alert_level": {"DataType": "String", "StringValue": current_status},
            "sensor_status": {"DataType": "String", "StringValue": current_status},
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
            previous_status = reading["previous_status"]
            current_status = reading["current_status"]

            if should_trigger_alert(previous_status, current_status):
                sns_message_id = publish_alert(reading, current_status)
                triggered_alerts.append(
                    {
                        "sqs_message_id": message_id,
                        "sns_message_id": sns_message_id,
                        "station_id": reading["station_id"],
                        "alert_level": current_status,
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
