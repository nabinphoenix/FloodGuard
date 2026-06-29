from __future__ import annotations

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException, status

from config import settings


sns_client = boto3.client(
    "sns",
    region_name=settings.aws_region,
    aws_access_key_id=settings.aws_access_key_id,
    aws_secret_access_key=settings.aws_secret_access_key,
)


def broadcast_alert(district: str, level: str, message: str) -> str:
    subject = f"FloodGuard {level.upper()} Alert - {district}"
    body = (
        "FloodGuard Early Warning Alert\n\n"
        f"District: {district}\n"
        f"Alert level: {level.upper()}\n\n"
        f"{message}\n\n"
        "Please follow local authority instructions and stay safe."
    )

    try:
        response = sns_client.publish(
            TopicArn=settings.sns_topic_arn,
            Subject=subject[:100],
            Message=body,
            MessageAttributes={
                "district": {"DataType": "String", "StringValue": district},
                "alert_level": {"DataType": "String", "StringValue": level},
            },
        )
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not publish alert to SNS.",
        ) from exc

    return response["MessageId"]


def subscribe_email(email: str) -> str:
    try:
        response = sns_client.subscribe(
            TopicArn=settings.sns_topic_arn,
            Protocol="email",
            Endpoint=email,
            ReturnSubscriptionArn=True,
        )
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not subscribe email to SNS.",
        ) from exc

    return response["SubscriptionArn"]


def unsubscribe(subscription_arn: str) -> None:
    try:
        sns_client.unsubscribe(SubscriptionArn=subscription_arn)
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not unsubscribe from SNS.",
        ) from exc
