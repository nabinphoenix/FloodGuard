import io
import logging
import os
from unittest.mock import MagicMock, patch

from PIL import Image

os.environ["AWS_EC2_METADATA_DISABLED"] = "true"
os.environ["OUTPUT_BUCKET"] = "test-output-bucket"
os.environ["INPUT_PREFIX"] = "original/incident-reports/"
os.environ["OUTPUT_PREFIX"] = "optimized/"
os.environ["METRIC_NAMESPACE"] = "TestNamespace"

from optimize_report_image import handler


def create_test_image(format="JPEG", mode="RGB", size=(2000, 2000)):
    image = Image.new(mode, size, color="red")
    image_bytes = io.BytesIO()
    image.save(image_bytes, format=format)
    return image_bytes.getvalue()


def image_event(key="original/incident-reports/test.jpg", bucket="input-bucket"):
    return {
        "Records": [
            {
                "eventName": "ObjectCreated:Put",
                "s3": {
                    "bucket": {"name": bucket},
                    "object": {"key": key},
                },
            }
        ]
    }


def configure_object(mock_s3, data, content_type="image/jpeg"):
    mock_s3.get_object.return_value = {
        "ContentType": content_type,
        "Body": MagicMock(read=MagicMock(return_value=data)),
    }


@patch("optimize_report_image.handler.s3_client")
@patch("optimize_report_image.handler.cloudwatch_client")
def test_smaller_candidate_is_written(mock_cw, mock_s3, caplog):
    original = b"original-image-bytes"
    candidate = b"small"
    configure_object(mock_s3, original)

    with patch.object(handler, "optimize_image", return_value=(candidate, "image/jpeg")):
        with caplog.at_level(logging.INFO):
            result = handler.lambda_handler(image_event(), None)

    assert result["images_optimized"] == 1
    put_kwargs = mock_s3.put_object.call_args.kwargs
    assert put_kwargs["Key"] == "optimized/incident-reports/test.jpg"
    assert put_kwargs["Body"] == candidate
    assert put_kwargs["ContentType"] == "image/jpeg"
    assert "result=optimized" in caplog.text
    assert "candidate_optimized_size=5" in caplog.text
    mock_cw.put_metric_data.assert_called_once()


@patch("optimize_report_image.handler.s3_client")
@patch("optimize_report_image.handler.cloudwatch_client")
def test_larger_candidate_falls_back_to_original(mock_cw, mock_s3, caplog):
    original = b"original"
    candidate = b"optimized-is-larger"
    configure_object(mock_s3, original)

    with patch.object(handler, "optimize_image", return_value=(candidate, "image/jpeg")):
        with caplog.at_level(logging.INFO):
            result = handler.lambda_handler(image_event(), None)

    assert result["images_optimized"] == 1
    assert mock_s3.put_object.call_args.kwargs["Body"] == original
    assert "result=original_kept" in caplog.text
    assert "candidate_optimized_size=19" in caplog.text


@patch("optimize_report_image.handler.s3_client")
@patch("optimize_report_image.handler.cloudwatch_client")
def test_equal_candidate_falls_back_to_original(mock_cw, mock_s3, caplog):
    original = b"same-size"
    configure_object(mock_s3, original)

    with patch.object(handler, "optimize_image", return_value=(b"same-size", "image/jpeg")):
        with caplog.at_level(logging.INFO):
            handler.lambda_handler(image_event(), None)

    assert mock_s3.put_object.call_args.kwargs["Body"] == original
    assert "result=original_kept" in caplog.text
    assert "candidate_optimized_size=9" in caplog.text


@patch("optimize_report_image.handler.s3_client")
@patch("optimize_report_image.handler.cloudwatch_client")
def test_larger_candidate_preserves_original_content_type(mock_cw, mock_s3):
    original = b"original"
    configure_object(mock_s3, original, "image/png")

    with patch.object(handler, "optimize_image", return_value=(b"optimized-is-larger", "image/webp")):
        handler.lambda_handler(image_event(key="original/incident-reports/test.png"), None)

    put_kwargs = mock_s3.put_object.call_args.kwargs
    assert put_kwargs["Body"] == original
    assert put_kwargs["ContentType"] == "image/png"
    assert len(put_kwargs["Body"]) <= len(original)

@patch("optimize_report_image.handler.s3_client")
@patch("optimize_report_image.handler.cloudwatch_client")
def test_output_key_is_decoded_and_keeps_incident_reports_prefix(mock_cw, mock_s3):
    original = b"original"
    configure_object(mock_s3, original)

    with patch.object(handler, "optimize_image", return_value=(b"small", "image/png")):
        handler.lambda_handler(
            image_event(key="original/incident-reports/test+image.png"),
            None,
        )

    put_kwargs = mock_s3.put_object.call_args.kwargs
    assert put_kwargs["Key"] == "optimized/incident-reports/test image.png"
    assert put_kwargs["ContentType"] == "image/png"


@patch("optimize_report_image.handler.s3_client")
@patch("optimize_report_image.handler.cloudwatch_client")
def test_recursion_prevention(mock_cw, mock_s3):
    result = handler.lambda_handler(
        image_event(
            key="optimized/incident-reports/test.jpg",
            bucket="test-output-bucket",
        ),
        None,
    )

    assert result["images_optimized"] == 0
    mock_s3.get_object.assert_not_called()
    mock_s3.put_object.assert_not_called()
    mock_cw.put_metric_data.assert_not_called()


@patch("optimize_report_image.handler.s3_client")
@patch("optimize_report_image.handler.cloudwatch_client")
def test_unrelated_original_object_is_skipped(mock_cw, mock_s3):
    result = handler.lambda_handler(image_event(key="original/profile/avatar.jpg"), None)

    assert result["images_optimized"] == 0
    mock_s3.get_object.assert_not_called()
    mock_s3.put_object.assert_not_called()


@patch("optimize_report_image.handler.s3_client")
@patch("optimize_report_image.handler.cloudwatch_client")
def test_real_jpeg_optimization_preserves_format_and_content_type(mock_cw, mock_s3):
    image_bytes = create_test_image(format="JPEG", size=(2000, 2000))
    configure_object(mock_s3, image_bytes, "image/jpeg")

    result = handler.lambda_handler(image_event(), None)

    assert result["images_optimized"] == 1
    put_kwargs = mock_s3.put_object.call_args.kwargs
    assert put_kwargs["ContentType"] == "image/jpeg"
    assert Image.open(io.BytesIO(put_kwargs["Body"])).size == (1200, 1200)


@patch("optimize_report_image.handler.s3_client")
@patch("optimize_report_image.handler.cloudwatch_client")
def test_unsupported_format_is_handled_safely(mock_cw, mock_s3):
    image_bytes = create_test_image(format="GIF", mode="P", size=(500, 500))
    configure_object(mock_s3, image_bytes, "image/gif")

    result = handler.lambda_handler(image_event(key="original/incident-reports/test.gif"), None)

    assert result["images_optimized"] == 1
    put_kwargs = mock_s3.put_object.call_args.kwargs
    assert put_kwargs["Body"] == image_bytes
    assert put_kwargs["ContentType"] == "image/gif"
    mock_cw.put_metric_data.assert_called_once()


@patch("optimize_report_image.handler.s3_client")
@patch("optimize_report_image.handler.cloudwatch_client")
def test_malformed_image_is_handled_safely(mock_cw, mock_s3, caplog):
    configure_object(mock_s3, b"not-an-image")

    with caplog.at_level(logging.WARNING):
        result = handler.lambda_handler(image_event(key="original/incident-reports/corrupt.jpg"), None)

    assert result["images_optimized"] == 1
    put_kwargs = mock_s3.put_object.call_args.kwargs
    assert put_kwargs["Body"] == b"not-an-image"
    assert put_kwargs["ContentType"] == "image/jpeg"
    assert "original kept" in caplog.text


@patch("optimize_report_image.handler.s3_client")
@patch("optimize_report_image.handler.cloudwatch_client")
def test_s3_failure_is_logged_without_writing(mock_cw, mock_s3, caplog):
    mock_s3.get_object.side_effect = RuntimeError("S3 unavailable")

    with caplog.at_level(logging.ERROR):
        result = handler.lambda_handler(image_event(), None)

    assert result["images_optimized"] == 0
    mock_s3.put_object.assert_not_called()
    assert "Image optimization failed for an S3 object" in caplog.text
