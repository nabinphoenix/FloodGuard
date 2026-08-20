import io
import os
from unittest.mock import MagicMock, patch

from PIL import Image

# Set environment before importing handler
os.environ["OUTPUT_BUCKET"] = "test-output-bucket"
os.environ["INPUT_PREFIX"] = "original/"
os.environ["OUTPUT_PREFIX"] = "optimized/"
os.environ["METRIC_NAMESPACE"] = "TestNamespace"

from optimize_report_image.handler import lambda_handler


def create_test_image(format="JPEG", mode="RGB", size=(2000, 2000)):
    img = Image.new(mode, size, color="red")
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format=format)
    img_byte_arr.seek(0)
    return img_byte_arr.read()


@patch("optimize_report_image.handler.s3_client")
@patch("optimize_report_image.handler.cloudwatch_client")
def test_successful_optimization(mock_cw, mock_s3):
    img_bytes = create_test_image(format="JPEG", size=(2000, 2000))

    mock_s3.get_object.return_value = {
        "ContentLength": len(img_bytes),
        "ContentType": "image/jpeg",
        "Body": MagicMock(read=MagicMock(return_value=img_bytes)),
    }

    event = {
        "Records": [
            {
                "eventName": "ObjectCreated:Put",
                "s3": {
                    "bucket": {"name": "input-bucket"},
                    "object": {"key": "original/test.jpg"},
                },
            }
        ]
    }

    result = lambda_handler(event, None)

    assert result["statusCode"] == 200
    assert result["images_optimized"] == 1

    mock_s3.get_object.assert_called_once_with(
        Bucket="input-bucket",
        Key="original/test.jpg",
    )

    mock_s3.put_object.assert_called_once()
    put_kwargs = mock_s3.put_object.call_args[1]

    assert put_kwargs["Bucket"] == "test-output-bucket"
    assert put_kwargs["Key"] == "optimized/test.jpg"
    assert put_kwargs["ContentType"] == "image/jpeg"

    output_body = put_kwargs["Body"]
    output_body.seek(0)
    output_img = Image.open(output_body)

    assert output_img.size == (1200, 1200)

    mock_cw.put_metric_data.assert_called_once()
    metric_kwargs = mock_cw.put_metric_data.call_args[1]

    assert metric_kwargs["Namespace"] == "TestNamespace"
    assert len(metric_kwargs["MetricData"]) == 3


@patch("optimize_report_image.handler.s3_client")
@patch("optimize_report_image.handler.cloudwatch_client")
def test_recursion_prevention(mock_cw, mock_s3):
    event = {
        "Records": [
            {
                "eventName": "ObjectCreated:Put",
                "s3": {
                    "bucket": {"name": "test-output-bucket"},
                    "object": {"key": "optimized/test.jpg"},
                },
            }
        ]
    }

    result = lambda_handler(event, None)

    assert result["statusCode"] == 200
    assert result["images_optimized"] == 0

    mock_s3.get_object.assert_not_called()
    mock_s3.put_object.assert_not_called()
    mock_cw.put_metric_data.assert_not_called()


@patch("optimize_report_image.handler.s3_client")
@patch("optimize_report_image.handler.cloudwatch_client")
def test_invalid_image_format(mock_cw, mock_s3):
    img_bytes = create_test_image(
        format="GIF",
        mode="P",
        size=(500, 500),
    )

    mock_s3.get_object.return_value = {
        "ContentLength": len(img_bytes),
        "ContentType": "image/gif",
        "Body": MagicMock(read=MagicMock(return_value=img_bytes)),
    }

    event = {
        "Records": [
            {
                "eventName": "ObjectCreated:Put",
                "s3": {
                    "bucket": {"name": "input-bucket"},
                    "object": {"key": "original/test.gif"},
                },
            }
        ]
    }

    result = lambda_handler(event, None)

    assert result["statusCode"] == 200
    assert result["images_optimized"] == 0

    mock_s3.put_object.assert_not_called()
    mock_cw.put_metric_data.assert_not_called()


@patch("optimize_report_image.handler.s3_client")
@patch("optimize_report_image.handler.cloudwatch_client")
def test_corrupt_image(mock_cw, mock_s3):
    mock_s3.get_object.return_value = {
        "ContentLength": 10,
        "ContentType": "image/jpeg",
        "Body": MagicMock(read=MagicMock(return_value=b"notanimage")),
    }

    event = {
        "Records": [
            {
                "eventName": "ObjectCreated:Put",
                "s3": {
                    "bucket": {"name": "input-bucket"},
                    "object": {"key": "original/corrupt.jpg"},
                },
            }
        ]
    }

    result = lambda_handler(event, None)

    assert result["statusCode"] == 200
    assert result["images_optimized"] == 0

    mock_s3.put_object.assert_not_called()
    mock_cw.put_metric_data.assert_not_called()
