from __future__ import annotations

import logging
from pathlib import PurePosixPath
from uuid import uuid4

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException, status

from config import settings

logger = logging.getLogger(__name__)

s3_client = boto3.client(
    "s3",
    region_name=settings.aws_region,
)

PRESIGNED_URL_EXPIRY = settings.s3_presigned_url_expires_seconds


def _original_key(s3_key: str) -> str:
    return f"{settings.s3_original_prefix.rstrip('/')}/{s3_key.lstrip('/')}"


def _optimized_key(s3_key: str) -> str:
    return f"{settings.s3_optimized_prefix.rstrip('/')}/{s3_key.lstrip('/')}"


def upload_photo(file_bytes: bytes, content_type: str, filename: str) -> str:
    """Upload a private report image and return its prefix-neutral object key."""
    safe_name = PurePosixPath(filename).name.replace(" ", "_")
    s3_key = f"incident-reports/{uuid4().hex}-{safe_name}"

    try:
        s3_client.put_object(
            Bucket=settings.s3_bucket_name,
            Key=_original_key(s3_key),
            Body=file_bytes,
            ContentType=content_type,
        )
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not upload photo to S3.",
        ) from exc

    return s3_key


def get_presigned_url(s3_key: str) -> str:
    """Return a temporary URL, preferring the optimized image when available."""
    optimized_key = _optimized_key(s3_key)
    original_key = _original_key(s3_key)

    try:
        s3_client.head_object(
            Bucket=settings.s3_bucket_name,
            Key=optimized_key,
        )
        object_key = optimized_key
    except (BotoCoreError, ClientError) as exc:
        if isinstance(exc, ClientError):
            error_code = exc.response.get("Error", {}).get("Code", "")
            if error_code not in {"404", "NoSuchKey", "NotFound"}:
                logger.warning("Could not check optimized image %s: %s", optimized_key, exc)
        else:
            logger.warning("Could not check optimized image %s: %s", optimized_key, exc)

        object_key = original_key

    try:
        return s3_client.generate_presigned_url(
            ClientMethod="get_object",
            Params={
                "Bucket": settings.s3_bucket_name,
                "Key": object_key,
            },
            ExpiresIn=PRESIGNED_URL_EXPIRY,
        )
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not generate presigned URL.",
        ) from exc


def delete_photo(s3_key: str) -> None:
    """Delete both original and optimized versions of a report image."""
    for object_key in (_original_key(s3_key), _optimized_key(s3_key)):
        try:
            s3_client.delete_object(
                Bucket=settings.s3_bucket_name,
                Key=object_key,
            )
        except (BotoCoreError, ClientError):
            logger.warning(
                "Failed to delete key %s from bucket %s",
                object_key,
                settings.s3_bucket_name,
            )
