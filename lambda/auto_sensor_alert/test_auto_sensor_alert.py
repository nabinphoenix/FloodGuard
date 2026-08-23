import json
import os
from unittest.mock import patch

import pytest

os.environ["SNS_TOPIC_ARN"] = "arn:aws:sns:us-east-1:123456789012:floodguard-alerts"

from auto_sensor_alert.handler import lambda_handler, should_trigger_alert


def sensor_event(previous_status, current_status, message_id="m1"):
    return {
        "Records": [
            {
                "messageId": message_id,
                "body": json.dumps({
                    "event_type": "sensor_reading",
                    "event_version": 2,
                    "reading": {
                        "station_id": "STN001",
                        "station_code": "STN001",
                        "station_name": "Narayani River Station",
                        "province": "Bagmati",
                        "district": "Chitwan",
                        "river_basin": "Gandaki / Narayani Basin",
                        "river_name": "Narayani",
                        "water_level": 3.6,
                        "current_status": current_status,
                        "previous_status": previous_status,
                        "watch_threshold": 2.5,
                        "warning_threshold": 3.5,
                        "danger_threshold": 4.5,
                        "recorded_at": "2026-08-23T12:00:00+00:00",
                        "source": "simulator-aws",
                    },
                }),
            },
        ],
    }


def test_should_trigger_alert_matches_sensor_transition_rules():
    assert should_trigger_alert("safe", "safe") is False
    assert should_trigger_alert("safe", "watch") is True
    assert should_trigger_alert("watch", "warning") is True
    assert should_trigger_alert("warning", "emergency") is True
    assert should_trigger_alert("warning", "warning") is False
    assert should_trigger_alert("emergency", "emergency") is False
    assert should_trigger_alert("emergency", "warning") is False
    assert should_trigger_alert("warning", "safe") is True
    assert should_trigger_alert("emergency", "safe") is True


@pytest.mark.parametrize(
    ("previous_status", "current_status", "publishes"),
    [
        ("safe", "watch", True),
        ("watch", "warning", True),
        ("warning", "emergency", True),
        ("warning", "warning", False),
        ("warning", "safe", True),
        ("emergency", "safe", True),
    ],
)
@patch("auto_sensor_alert.handler.sns_client")
@patch("auto_sensor_alert.handler.cloudwatch_client")
def test_lambda_handler_processes_canonical_status_transitions(
    mock_cloudwatch,
    mock_sns,
    previous_status,
    current_status,
    publishes,
):
    mock_sns.publish.return_value = {"MessageId": "sns-m1"}

    result = lambda_handler(sensor_event(previous_status, current_status), None)

    assert result["processed_records"] == 1
    assert result["failed_records"] == []
    assert len(result["triggered_alerts"]) == int(publishes)
    assert mock_sns.publish.call_count == int(publishes)
    if publishes:
        assert result["triggered_alerts"][0]["alert_level"] == current_status
        mock_cloudwatch.put_metric_data.assert_called_once()
    else:
        mock_cloudwatch.put_metric_data.assert_not_called()


@patch("auto_sensor_alert.handler.sns_client")
@patch("auto_sensor_alert.handler.cloudwatch_client")
def test_lambda_handler_accepts_in_flight_v1_producer_fields(mock_cloudwatch, mock_sns):
    mock_sns.publish.return_value = {"MessageId": "sns-v1"}
    event = sensor_event("safe", "watch", "legacy")
    legacy_reading = json.loads(event["Records"][0]["body"])["reading"]
    legacy_reading["name"] = legacy_reading.pop("station_name")
    legacy_reading["status"] = legacy_reading.pop("current_status")
    legacy_reading["timestamp"] = legacy_reading.pop("recorded_at")
    event["Records"][0]["body"] = json.dumps({
        "event_type": "sensor_reading",
        "event_version": 1,
        "reading": legacy_reading,
    })

    result = lambda_handler(event, None)

    assert result["failed_records"] == []
    assert len(result["triggered_alerts"]) == 1
    mock_sns.publish.assert_called_once()
    mock_cloudwatch.put_metric_data.assert_called_once()


@patch("auto_sensor_alert.handler.sns_client")
@patch("auto_sensor_alert.handler.cloudwatch_client")
def test_lambda_handler_handles_malformed_record_safely(mock_cloudwatch, mock_sns):
    event = {
        "Records": [
            {
                "messageId": "malformed",
                "body": json.dumps({
                    "event_type": "sensor_reading",
                    "event_version": 2,
                    "reading": {"station_id": "STN001"},
                }),
            },
        ],
    }

    result = lambda_handler(event, None)

    mock_sns.publish.assert_not_called()
    mock_cloudwatch.put_metric_data.assert_not_called()
    assert result["processed_records"] == 1
    assert result["failed_records"] == [{"itemIdentifier": "malformed"}]
    assert result["batchItemFailures"] == [{"itemIdentifier": "malformed"}]
