"""Repair optimized report images that are larger than their originals.

The default mode is a dry run. Use --apply only after reviewing the output.
This script never deletes or changes objects under the original/ prefix.
"""

from __future__ import annotations

import argparse
import os
from typing import Any, Iterator

import boto3
from botocore.exceptions import ClientError

ORIGINAL_PREFIX = "original/incident-reports/"
OPTIMIZED_PREFIX = "optimized/incident-reports/"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--bucket",
        default=os.getenv("S3_BUCKET_NAME") or os.getenv("S3_BUCKET") or os.getenv("OUTPUT_BUCKET"),
        help="S3 bucket (defaults to S3_BUCKET_NAME, S3_BUCKET, or OUTPUT_BUCKET)",
    )
    parser.add_argument("--region", default=os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION"))
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="Report replacements without changing S3 (default)")
    mode.add_argument("--apply", action="store_true", help="Copy oversized originals over optimized objects")
    return parser.parse_args()


def iter_original_keys(s3: Any, bucket: str) -> Iterator[str]:
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix=ORIGINAL_PREFIX):
        for item in page.get("Contents", []):
            key = item.get("Key", "")
            if key.startswith(ORIGINAL_PREFIX) and not key.endswith("/"):
                yield key


def original_metadata(head: dict[str, Any]) -> dict[str, Any]:
    """Return safe metadata fields while preserving the original Content-Type."""
    metadata = {
        "ContentType": head.get("ContentType") or "application/octet-stream",
        "Metadata": head.get("Metadata", {}),
        "MetadataDirective": "REPLACE",
    }
    for field in ("CacheControl", "ContentDisposition", "ContentEncoding", "ContentLanguage", "Expires"):
        if head.get(field) is not None:
            metadata[field] = head[field]
    return metadata


def repair_oversized_objects(s3: Any, bucket: str, dry_run: bool = True) -> tuple[int, int]:
    checked = 0
    changed = 0

    for original_key in iter_original_keys(s3, bucket):
        relative_key = original_key[len(ORIGINAL_PREFIX) :]
        optimized_key = f"{OPTIMIZED_PREFIX}{relative_key}"
        original_head = s3.head_object(Bucket=bucket, Key=original_key)
        try:
            optimized_head = s3.head_object(Bucket=bucket, Key=optimized_key)
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") in {"404", "NoSuchKey", "NotFound"}:
                continue
            raise

        checked += 1
        original_size = int(original_head["ContentLength"])
        optimized_size = int(optimized_head["ContentLength"])
        if optimized_size <= original_size:
            print(
                f"KEEP {optimized_key} | original_size={original_size} "
                f"optimized_size={optimized_size}"
            )
            continue

        changed += 1
        action = "WOULD_REPLACE" if dry_run else "REPLACED"
        print(
            f"{action} {optimized_key} | original_size={original_size} "
            f"optimized_size={optimized_size} final_size={original_size}"
        )
        if not dry_run:
            s3.copy_object(
                Bucket=bucket,
                Key=optimized_key,
                CopySource={"Bucket": bucket, "Key": original_key},
                **original_metadata(original_head),
            )

    return checked, changed


def main() -> int:
    args = parse_args()
    if not args.bucket:
        raise SystemExit("Set S3_BUCKET_NAME or pass --bucket.")

    dry_run = not args.apply
    session = boto3.session.Session(region_name=args.region)
    s3 = session.client("s3")
    checked, changed = repair_oversized_objects(s3, args.bucket, dry_run=dry_run)
    mode = "dry-run" if dry_run else "apply"
    print(f"Completed {mode}: checked={checked} oversized={changed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
