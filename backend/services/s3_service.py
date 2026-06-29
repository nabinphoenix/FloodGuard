from __future__ import annotations

from pathlib import PurePosixPath
from urllib.parse import quote, unquote, urlparse
from uuid import uuid4

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException, status

from config import settings


s3_client = boto3.client(
    "s3",
    region_name=settings.aws_region,
    aws_access_key_id=settings.aws_access_key_id,
    aws_secret_access_key=settings.aws_secret_access_key,
)


def _public_url(s3_key: str) -> str:
    encoded_key = quote(s3_key, safe="/")
    return f"https://{settings.s3_bucket_name}.s3.{settings.aws_region}.amazonaws.com/{encoded_key}"


def _key_from_url(s3_url: str) -> str:
    parsed_url = urlparse(s3_url)
    path_key = unquote(parsed_url.path.lstrip("/"))

    if not path_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid S3 URL.",
        )

    return path_key


def upload_photo(file_bytes: bytes, content_type: str, filename: str) -> str:
    safe_name = PurePosixPath(filename).name.replace(" ", "_")
    s3_key = f"incident-reports/{uuid4().hex}-{safe_name}"

    try:
        s3_client.put_object(
            Bucket=settings.s3_bucket_name,
            Key=s3_key,
            Body=file_bytes,
            ContentType=content_type,
            ACL="public-read",
        )
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not upload photo to S3.",
        ) from exc

    return _public_url(s3_key)


def delete_photo(s3_url: str) -> None:
    s3_key = _key_from_url(s3_url)

    try:
        s3_client.delete_object(Bucket=settings.s3_bucket_name, Key=s3_key)
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not delete photo from S3.",
        ) from exc


def get_presigned_url(s3_key: str) -> str:
    try:
        return s3_client.generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": settings.s3_bucket_name, "Key": s3_key},
            ExpiresIn=3600,
        )
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not generate presigned URL.",
        ) from exc
