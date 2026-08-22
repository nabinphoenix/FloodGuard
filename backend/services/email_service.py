from __future__ import annotations

import logging

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from config import settings


logger = logging.getLogger(__name__)


class EmailDeliveryError(RuntimeError):
    """Raised when the private reset email cannot be delivered."""


ses_client = boto3.client("ses", region_name=settings.aws_region)


def send_password_reset_email(recipient_email: str, reset_url: str) -> str:
    """Send a one-recipient password reset email through SES.

    Reset emails are deliberately kept separate from the public SNS alert
    topic so a private account link can never be broadcast to subscribers.
    """
    if not settings.ses_from_email:
        raise EmailDeliveryError("SES_FROM_EMAIL is not configured.")

    body = (
        "Hello,\n\n"
        "We received a request to reset your FloodGuard password. Use the secure link below to choose a new password:\n\n"
        f"{reset_url}\n\n"
        f"This link expires in {settings.password_reset_token_minutes} minutes and can only be used once. "
        "If you did not request this change, you can safely ignore this email.\n\n"
        "FloodGuard Support\n"
        f"{settings.frontend_base_url.rstrip('/')}"
    )

    try:
        response = ses_client.send_email(
            Source=settings.ses_from_email,
            Destination={"ToAddresses": [recipient_email]},
            Message={
                "Subject": {
                    "Data": "Reset your FloodGuard password",
                    "Charset": "UTF-8",
                },
                "Body": {
                    "Text": {
                        "Data": body,
                        "Charset": "UTF-8",
                    }
                },
            },
        )
    except (BotoCoreError, ClientError) as exc:
        logger.error("SES password reset delivery failed for recipient domain")
        raise EmailDeliveryError("Password reset email could not be delivered.") from exc

    message_id = response.get("MessageId")
    if not message_id:
        raise EmailDeliveryError("SES did not return a message identifier.")
    return message_id
