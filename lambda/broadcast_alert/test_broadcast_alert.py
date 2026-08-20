import json
import os
import pytest
from unittest.mock import patch, MagicMock

os.environ['SNS_TOPIC_ARN'] = 'arn:aws:sns:us-east-1:123456789012:test-topic'
os.environ['METRIC_NAMESPACE'] = 'TestNamespace'

from broadcast_alert.handler import lambda_handler

def create_event(body):
    return {
        'body': json.dumps(body)
    }

@patch('broadcast_alert.handler.sns_client')
@patch('broadcast_alert.handler.cloudwatch_client')
def test_valid_request(mock_cw, mock_sns):
    mock_sns.publish.return_value = {'MessageId': 'sns-m1'}

    event = create_event({
        'district': 'Kathmandu',
        'alert_level': 'warning',
        'message': 'Water levels are rising.'
    })

    result = lambda_handler(event, None)

    assert result['statusCode'] == 200
    body = json.loads(result['body'])
    assert 'sns_message_id' in body

    mock_sns.publish.assert_called_once()
    mock_cw.put_metric_data.assert_called_once()


@patch('broadcast_alert.handler.sns_client')
@patch('broadcast_alert.handler.cloudwatch_client')
def test_invalid_alert_level(mock_cw, mock_sns):
    event = create_event({
        'district': 'Kathmandu',
        'alert_level': 'not-an-alert-level',
        'message': 'Water levels are rising.'
    })

    result = lambda_handler(event, None)

    assert result['statusCode'] == 400
    mock_sns.publish.assert_not_called()


@patch('broadcast_alert.handler.sns_client')
@patch('broadcast_alert.handler.cloudwatch_client')
def test_missing_district(mock_cw, mock_sns):
    event = create_event({
        'alert_level': 'warning',
        'message': 'Water levels are rising.'
    })

    result = lambda_handler(event, None)

    assert result['statusCode'] == 400
    mock_sns.publish.assert_not_called()


@patch('broadcast_alert.handler.sns_client')
@patch('broadcast_alert.handler.cloudwatch_client')
def test_missing_message(mock_cw, mock_sns):
    event = create_event({
        'district': 'Kathmandu',
        'alert_level': 'warning'
    })

    result = lambda_handler(event, None)

    assert result['statusCode'] == 400
    mock_sns.publish.assert_not_called()


@patch('broadcast_alert.handler.sns_client')
@patch('broadcast_alert.handler.cloudwatch_client')
def test_sns_failure(mock_cw, mock_sns):
    mock_sns.publish.side_effect = Exception('SNS failure')

    event = create_event({
        'district': 'Kathmandu',
        'alert_level': 'warning',
        'message': 'Water levels are rising.'
    })

    with pytest.raises(Exception):
        lambda_handler(event, None)
