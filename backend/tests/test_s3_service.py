from unittest.mock import MagicMock

from botocore.exceptions import ClientError

from services import s3_service


def test_presigned_url_prefers_private_optimized_object(monkeypatch):
    bucket = s3_service.settings.s3_bucket_name
    s3 = MagicMock()
    s3.generate_presigned_url.return_value = "https://signed.example/optimized"
    monkeypatch.setattr(s3_service, "s3_client", s3)

    result = s3_service.get_presigned_url("incident-reports/report.jpg")

    assert result == "https://signed.example/optimized"
    s3.head_object.assert_called_once_with(
        Bucket=bucket,
        Key="optimized/incident-reports/report.jpg",
    )
    s3.generate_presigned_url.assert_called_once_with(
        ClientMethod="get_object",
        Params={
            "Bucket": bucket,
            "Key": "optimized/incident-reports/report.jpg",
        },
        ExpiresIn=s3_service.PRESIGNED_URL_EXPIRY,
    )


def test_presigned_url_falls_back_to_private_original_object(monkeypatch):
    bucket = s3_service.settings.s3_bucket_name
    s3 = MagicMock()
    s3.head_object.side_effect = ClientError(
        {"Error": {"Code": "404", "Message": "missing"}},
        "HeadObject",
    )
    s3.generate_presigned_url.return_value = "https://signed.example/original"
    monkeypatch.setattr(s3_service, "s3_client", s3)

    result = s3_service.get_presigned_url("incident-reports/report.jpg")

    assert result == "https://signed.example/original"
    assert s3.generate_presigned_url.call_args.kwargs["Params"] == {
        "Bucket": bucket,
        "Key": "original/incident-reports/report.jpg",
    }
    assert "s3.amazonaws.com" not in result
