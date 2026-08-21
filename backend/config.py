from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = Field(..., alias="DATABASE_URL")
    secret_key: str = Field(..., alias="SECRET_KEY")
    sensor_ingestion_token: str = Field("", alias="SENSOR_INGESTION_TOKEN")
    aws_region: str = Field(..., alias="AWS_REGION")

    s3_bucket_name: str = Field(..., alias="S3_BUCKET_NAME")
    s3_original_prefix: str = Field("original/", alias="S3_ORIGINAL_PREFIX")
    s3_optimized_prefix: str = Field("optimized/", alias="S3_OPTIMIZED_PREFIX")
    s3_presigned_url_expires_seconds: int = Field(
        900,
        alias="S3_PRESIGNED_URL_EXPIRES_SECONDS",
    )

    sns_topic_arn: str = Field(..., alias="SNS_TOPIC_ARN")
    sqs_sensor_queue_url: str = Field(..., alias="SQS_SENSOR_QUEUE_URL")
    # Optional: this repository currently persists telemetry in RDS. If an
    # existing DynamoDB sensor table is configured in a deployment, health
    # checks can verify it without creating or replacing that resource.
    dynamodb_sensor_table_name: str = Field("", alias="DYNAMODB_SENSOR_TABLE_NAME")
    broadcast_api_url: str = Field(..., alias="BROADCAST_API_URL")
    cors_origins: str = Field(..., alias="CORS_ORIGINS")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
