from __future__ import annotations

import hashlib
import hmac
import logging
import re

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from config import settings


logger = logging.getLogger(__name__)
sns_client = boto3.client("sns", region_name=settings.aws_region)


class EmailDeliveryError(RuntimeError):
    """Raised when private SNS reset delivery cannot be prepared or sent."""


class EmailSubscriptionPending(EmailDeliveryError):
    """Raised when the recipient still needs to confirm their SNS email subscription."""


def _normalized_email(recipient_email: str) -> str:
    return recipient_email.strip().lower()


def _private_topic_name(recipient_email: str) -> str:
    normalized_email = _normalized_email(recipient_email)
    recipient_digest = hmac.new(
        settings.secret_key.encode("utf-8"),
        normalized_email.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:32]
    prefix = re.sub(r"[^A-Za-z0-9_-]", "-", settings.password_reset_sns_topic_prefix).strip("-_")
    prefix = prefix or "FloodGuard-Password-Reset-User"
    return f"{prefix[:223]}-{recipient_digest}"


def _list_topic_subscriptions(topic_arn: str) -> list[dict]:
    subscriptions: list[dict] = []
    next_token: str | None = None
    while True:
        request = {"TopicArn": topic_arn}
        if next_token:
            request["NextToken"] = next_token
        response = sns_client.list_subscriptions_by_topic(**request)
        subscriptions.extend(response.get("Subscriptions", []))
        next_token = response.get("NextToken")
        if not next_token:
            return subscriptions


def _is_confirmed(subscription: dict) -> bool:
    subscription_arn = str(subscription.get("SubscriptionArn", ""))
    if not subscription_arn.startswith("arn:aws:sns:"):
        return False

    response = sns_client.get_subscription_attributes(SubscriptionArn=subscription_arn)
    attributes = response.get("Attributes", {})
    return str(attributes.get("PendingConfirmation", "true")).lower() == "false"


def _assert_private_topic(subscriptions: list[dict], recipient_email: str) -> list[dict]:
    normalized_email = _normalized_email(recipient_email)
    unexpected = [
        subscription
        for subscription in subscriptions
        if str(subscription.get("Protocol", "")).lower() != "email"
        or _normalized_email(str(subscription.get("Endpoint", ""))) != normalized_email
    ]
    if unexpected:
        logger.error("Password reset SNS topic has an unexpected subscriber; refusing to publish")
        raise EmailDeliveryError("Password reset email could not be delivered safely.")

    confirmed = [subscription for subscription in subscriptions if _is_confirmed(subscription)]
    if len(confirmed) > 1:
        logger.error("Password reset SNS topic has duplicate confirmed subscribers; refusing to publish")
        raise EmailDeliveryError("Password reset email could not be delivered safely.")
    return confirmed


def ensure_password_reset_subscription(recipient_email: str) -> str | None:
    """Return the private topic ARN when its sole email subscription is confirmed.

    The first call creates an account-specific topic and sends the AWS SNS
    confirmation email. The caller must retry after the recipient confirms.
    """
    normalized_email = _normalized_email(recipient_email)
    try:
        topic_response = sns_client.create_topic(Name=_private_topic_name(normalized_email))
        topic_arn = topic_response.get("TopicArn")
        if not topic_arn:
            raise EmailDeliveryError("SNS did not return a password reset topic ARN.")

        subscriptions = _list_topic_subscriptions(topic_arn)
        confirmed = _assert_private_topic(subscriptions, normalized_email)
        if confirmed:
            return topic_arn

        sns_client.subscribe(
            TopicArn=topic_arn,
            Protocol="email",
            Endpoint=normalized_email,
            ReturnSubscriptionArn=True,
        )
        return None
    except EmailDeliveryError:
        raise
    except (BotoCoreError, ClientError) as exc:
        logger.error("SNS password reset subscription preparation failed")
        raise EmailDeliveryError("Password reset email could not be prepared.") from exc


def send_password_reset_email(recipient_email: str, reset_url: str) -> str:
    """Publish a reset link only to the recipient's audited private SNS topic."""
    topic_arn = ensure_password_reset_subscription(recipient_email)
    if topic_arn is None:
        raise EmailSubscriptionPending("SNS email subscription confirmation is required.")

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
        response = sns_client.publish(
            TopicArn=topic_arn,
            Subject="Reset your FloodGuard password",
            Message=body,
        )
    except (BotoCoreError, ClientError) as exc:
        logger.error("SNS password reset delivery failed")
        raise EmailDeliveryError("Password reset email could not be delivered.") from exc

    message_id = response.get("MessageId")
    if not message_id:
        raise EmailDeliveryError("SNS did not return a password reset message identifier.")
    return message_id
