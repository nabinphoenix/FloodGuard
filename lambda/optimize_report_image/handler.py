import io
import os
import boto3
import urllib.parse
from datetime import datetime, timezone
from PIL import Image, UnidentifiedImageError

s3_client = boto3.client('s3')
cloudwatch_client = boto3.client('cloudwatch')

OUTPUT_BUCKET = os.environ["OUTPUT_BUCKET"]
INPUT_PREFIX = os.environ.get("INPUT_PREFIX", "original/")
OUTPUT_PREFIX = os.environ.get("OUTPUT_PREFIX", "optimized/")
METRIC_NAMESPACE = os.environ.get("METRIC_NAMESPACE", "FloodGuard")

MAX_SIZE = (1200, 1200)
ALLOWED_FORMATS = {'JPEG', 'PNG', 'WEBP'}


def put_metric(images_optimized: int, original_bytes: int, optimized_bytes: int) -> None:
    if images_optimized <= 0:
        return

    cloudwatch_client.put_metric_data(
        Namespace=METRIC_NAMESPACE,
        MetricData=[
            {
                'MetricName': 'ImagesOptimized',
                'Value': images_optimized,
                'Unit': 'Count',
                'Timestamp': datetime.now(timezone.utc)
            },
            {
                'MetricName': 'OriginalBytes',
                'Value': original_bytes,
                'Unit': 'Bytes',
                'Timestamp': datetime.now(timezone.utc)
            },
            {
                'MetricName': 'OptimizedBytes',
                'Value': optimized_bytes,
                'Unit': 'Bytes',
                'Timestamp': datetime.now(timezone.utc)
            }
        ]
    )


def lambda_handler(event, context):
    images_optimized = 0
    original_bytes_total = 0
    optimized_bytes_total = 0

    for record in event.get('Records', []):
        event_name = record.get('eventName', '')
        if not event_name.startswith('ObjectCreated:'):
            continue

        try:
            source_bucket = record['s3']['bucket']['name']
            source_key = urllib.parse.unquote_plus(record['s3']['object']['key'])

            # Only process objects uploaded under original/
            if not source_key.startswith(INPUT_PREFIX):
                print(f"Skipping {source_key}; it is outside {INPUT_PREFIX}")
                continue

            relative_key = source_key[len(INPUT_PREFIX):]

            if not relative_key:
                continue

            output_key = f"{OUTPUT_PREFIX}{relative_key}"

            # Download image
            response = s3_client.get_object(Bucket=source_bucket, Key=source_key)
            original_bytes = response.get('ContentLength', 0)
            original_content_type = response.get('ContentType', '')

            img_data = response['Body'].read()
            img = Image.open(io.BytesIO(img_data))

            if img.format not in ALLOWED_FORMATS:
                print(f"Skipping unsupported format {img.format} for key {source_key}")
                continue

            if img.mode in ('RGBA', 'P') and img.format == 'JPEG':
                img = img.convert('RGB')

            img.thumbnail(MAX_SIZE, Image.Resampling.LANCZOS)

            output_buffer = io.BytesIO()
            save_format = img.format if img.format else 'JPEG'
            img.save(output_buffer, format=save_format, optimize=True, quality=85)

            optimized_bytes = output_buffer.tell()
            output_buffer.seek(0)

            s3_client.put_object(
                Bucket=OUTPUT_BUCKET,
                Key=output_key,
                Body=output_buffer,
                ContentType=original_content_type
            )

            images_optimized += 1
            original_bytes_total += original_bytes
            optimized_bytes_total += optimized_bytes
            print(
                f"Optimized {source_key} -> {output_key}: "
                f"{original_bytes} -> {optimized_bytes} bytes"
            )

        except UnidentifiedImageError:
            print(f"File {source_key} is not a valid image.")
        except Exception as e:
            print(f"Error processing {source_key} from bucket {source_bucket}: {e}")

    put_metric(images_optimized, original_bytes_total, optimized_bytes_total)

    return {
        'statusCode': 200,
        'images_optimized': images_optimized
    }