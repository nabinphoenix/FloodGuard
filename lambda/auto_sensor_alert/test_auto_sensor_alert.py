import json
import pytest
import os
from unittest.mock import patch, MagicMock

os.environ["SNS_TOPIC_ARN"] = "arn:aws:sns:us-east-1:123456789012:floodguard-alerts"

from auto_sensor_alert.handler import lambda_handler, should_trigger_alert


def test_should_trigger_alert():
    assert should_trigger_alert("safe", "safe") == False
    assert should_trigger_alert("safe", "warning") == True
    assert should_trigger_alert("safe", "emergency") == True
    assert should_trigger_alert("warning", "warning") == False
    assert should_trigger_alert("warning", "emergency") == True
    assert should_trigger_alert("emergency", "emergency") == False
    assert should_trigger_alert("emergency", "warning") == False
    assert should_trigger_alert("warning", "safe") == False


@patch("auto_sensor_alert.handler.sns_client")
@patch("auto_sensor_alert.handler.cloudwatch_client")
def test_lambda_handler_safe_to_safe(mock_cw, mock_sns):
    event = {
        "Records": [
            {
                "messageId": "m1",
                "body": json.dumps({
                    "event_type": "sensor_reading",
                    "event_version": 1,
                    "reading": {
                        "station_id": "st1",
                        "district": "d1",
                        "water_level": 1.0,
                        "warning_threshold": 3.0,
                        "danger_threshold": 4.0,
                        "previous_alert_level": "safe",
                        "current_alert_level": "safe"
                    }
                })
            }
        ]
    }

    result = lambda_handler(event, None)

    mock_sns.publish.assert_not_called()
    assert result["processed_records"] == 1
    assert len(result["triggered_alerts"]) == 0
    assert len(result["failed_records"]) == 0


@patch("auto_sensor_alert.handler.sns_client")
@patch("auto_sensor_alert.handler.cloudwatch_client")
def test_lambda_handler_escalation(mock_cw, mock_sns):
    mock_sns.publish.return_value = {"MessageId": "sns-m1"}

    event = {
        "Records": [
            {
                "messageId": "m2",
                "body": json.dumps({
                    "event_type": "sensor_reading",
                    "event_version": 1,
                    "reading": {
                        "station_id": "st1",
                        "district": "d1",
                        "water_level": 3.5,
                        "warning_threshold": 3.0,
                        "danger_threshold": 4.0,
                        "previous_alert_level": "safe",
                        "current_alert_level": "warning"
                    }
                })
            }
        ]
    }

    result = lambda_handler(event, None)

    mock_sns.publish.assert_called_once()
    assert result["processed_records"] == 1
    assert len(result["triggered_alerts"]) == 1
    assert len(result["failed_records"]) == 0


@patch("auto_sensor_alert.handler.sns_client")
@patch("auto_sensor_alert.handler.cloudwatch_client")
def test_lambda_handler_malformed_record(mock_cw, mock_sns):
    event = {
        "Records": [
            {
                "messageId": "m3",
                "body": "not-json"
            }
        ]
    }

    result = lambda_handler(event, None)

    mock_sns.publish.assert_not_called()
    assert result["processed_records"] == 1
    assert len(result["failed_records"]) == 1
    assert result["batchItemFailures"] == [{"itemIdentifier": "m3"}]
