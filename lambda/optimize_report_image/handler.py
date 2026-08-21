import io
import logging
import os
import urllib.parse
from datetime import datetime, timezone

import boto3
from PIL import Image, UnidentifiedImageError

logger = logging.getLogger(__name__)

s3_client = boto3.client("s3")
cloudwatch_client = boto3.client("cloudwatch")

OUTPUT_BUCKET = os.environ["OUTPUT_BUCKET"]
SOURCE_ROOT_PREFIX = "original/"
REQUIRED_INPUT_PREFIX = "original/incident-reports/"
INPUT_PREFIX = os.environ.get("INPUT_PREFIX", SOURCE_ROOT_PREFIX).rstrip("/") + "/"
OUTPUT_PREFIX = os.environ.get("OUTPUT_PREFIX", "optimized/").rstrip("/") + "/"
METRIC_NAMESPACE = os.environ.get("METRIC_NAMESPACE", "FloodGuard")

MAX_SIZE = (1200, 1200)
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
CONTENT_TYPES = {
    "JPEG": "image/jpeg",
    "PNG": "image/png",
    "WEBP": "image/webp",
}


class UnsupportedImageFormat(ValueError):
    """Raised when an uploaded object is not a supported report image."""


def put_metric(images_optimized: int, original_bytes: int, optimized_bytes: int) -> None:
    if images_optimized <= 0:
        return

    try:
        cloudwatch_client.put_metric_data(
            Namespace=METRIC_NAMESPACE,
            MetricData=[
                {
                    "MetricName": "ImagesOptimized",
                    "Value": images_optimized,
                    "Unit": "Count",
                    "Timestamp": datetime.now(timezone.utc),
                },
                {
                    "MetricName": "OriginalBytes",
                    "Value": original_bytes,
                    "Unit": "Bytes",
                    "Timestamp": datetime.now(timezone.utc),
                },
                {
                    "MetricName": "OptimizedBytes",
                    "Value": optimized_bytes,
                    "Unit": "Bytes",
                    "Timestamp": datetime.now(timezone.utc),
                },
            ],
        )
    except Exception:
        logger.exception("Image optimization metrics could not be published")


def optimize_image(image_bytes: bytes) -> tuple[bytes, str]:
    """Create a candidate image and return its bytes and correct media type."""
    with Image.open(io.BytesIO(image_bytes)) as source:
        source.load()
        image_format = source.format
        if image_format not in ALLOWED_FORMATS:
            raise UnsupportedImageFormat(image_format or "unknown")

        image = source.copy()

    if image_format == "JPEG" and image.mode not in ("RGB", "L"):
        image = image.convert("RGB")

    image.thumbnail(MAX_SIZE, Image.Resampling.LANCZOS)

    output_buffer = io.BytesIO()
    save_options = {"optimize": True}
    if image_format in {"JPEG", "WEBP"}:
        save_options["quality"] = 85
    image.save(output_buffer, format=image_format, **save_options)
    return output_buffer.getvalue(), CONTENT_TYPES[image_format]


def _is_intended_source_key(source_key: str) -> bool:
    return source_key.startswith(INPUT_PREFIX) and source_key.startswith(REQUIRED_INPUT_PREFIX)


def lambda_handler(event, context):
    images_optimized = 0
    original_bytes_total = 0
    optimized_bytes_total = 0

    for record in event.get("Records", []):
        event_name = record.get("eventName", "")
        source_bucket = "unknown"
        source_key = ""

        if not event_name.startswith("ObjectCreated:"):
            continue

        try:
            source_bucket = record["s3"]["bucket"]["name"]
            source_key = urllib.parse.unquote_plus(record["s3"]["object"]["key"])

            if not _is_intended_source_key(source_key):
                logger.info("Skipping object outside the report-image source prefix")
                continue

            relative_key = source_key[len(SOURCE_ROOT_PREFIX):]
            if not relative_key:
                logger.info("Skipping empty report-image object key")
                continue

            output_key = f"{OUTPUT_PREFIX}{relative_key}"
            response = s3_client.get_object(Bucket=source_bucket, Key=source_key)
            original_data = response["Body"].read()
            original_size = len(original_data)

            candidate_data, content_type = optimize_image(original_data)
            candidate_size = len(candidate_data)

            if candidate_size < original_size:
                output_data = candidate_data
                selected = "optimized"
                saved_bytes = original_size - candidate_size
                reduction_percent = (saved_bytes / original_size * 100) if original_size else 0
                reason = ""
            else:
                output_data = original_data
                selected = "original"
                saved_bytes = 0
                reduction_percent = 0
                reason = "optimized candidate was not smaller"

            s3_client.put_object(
                Bucket=OUTPUT_BUCKET,
                Key=output_key,
                Body=output_data,
                ContentType=content_type,
            )

            images_optimized += 1
            original_bytes_total += original_size
            optimized_bytes_total += len(output_data)
            if reason:
                logger.info(
                    "Image optimization completed | Original bytes: %d | Candidate bytes: %d | "
                    "Selected: %s | Saved bytes: %d | Reduction percent: %.2f | Reason: %s",
                    original_size,
                    candidate_size,
                    selected,
                    saved_bytes,
                    reduction_percent,
                    reason,
                )
            else:
                logger.info(
                    "Image optimization completed | Original bytes: %d | Candidate bytes: %d | "
                    "Selected: %s | Saved bytes: %d | Reduction percent: %.2f",
                    original_size,
                    candidate_size,
                    selected,
                    saved_bytes,
                    reduction_percent,
                )

        except UnsupportedImageFormat as exc:
            logger.warning("Image optimization skipped: unsupported image format %s", exc)
        except UnidentifiedImageError:
            logger.warning("Image optimization skipped: object is not a valid image")
        except Exception:
            logger.exception("Image optimization failed for an S3 object")

    put_metric(images_optimized, original_bytes_total, optimized_bytes_total)

    return {
        "statusCode": 200,
        "images_optimized": images_optimized,
    }
