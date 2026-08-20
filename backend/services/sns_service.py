from __future__ import annotations

import logging

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException, status

from config import settings


logger = logging.getLogger(__name__)

sns_client = boto3.client(
    "sns",
    region_name=settings.aws_region,
)


def is_subscription_confirmed(subscription_arn: str | None) -> bool:
    """Return True when the SNS subscription has been confirmed."""
    if not subscription_arn:
        return False
    return subscription_arn != "PendingConfirmation"


def subscribe_email(email: str) -> str:
    """Subscribe an email address to the FloodGuard SNS topic."""
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


def unsubscribe(subscription_arn: str | None) -> None:
    """Unsubscribe a confirmed SNS email subscription."""
    if not is_subscription_confirmed(subscription_arn):
        return

    try:
        sns_client.unsubscribe(
            SubscriptionArn=subscription_arn,
        )
    except (BotoCoreError, ClientError) as exc:
        logger.warning(
            "Failed to unsubscribe SNS subscription %s: %s",
            subscription_arn,
            exc,
        )


def broadcast_alert(
    district: str,
    level: str,
    message: str,
) -> str:
    """Publish a FloodGuard emergency alert to the configured SNS topic."""

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
                "district": {
                    "DataType": "String",
                    "StringValue": district,
                },
                "alert_level": {
                    "DataType": "String",
                    "StringValue": level,
                },
            },
        )
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not publish alert to SNS.",
        ) from exc

    return response["MessageId"]
