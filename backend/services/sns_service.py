from __future__ import annotations

import logging

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException, status

from config import settings
from services.alert_message_service import build_flood_alert_message


logger = logging.getLogger(__name__)

sns_client = boto3.client(
    "sns",
    region_name=settings.aws_region,
)

PENDING_CONFIRMATION_ARN = "PendingConfirmation"
SUBSCRIPTION_DISABLED = "disabled"
SUBSCRIPTION_PENDING = "pending"
SUBSCRIPTION_CONFIRMED = "confirmed"
SENSOR_SEVERITY = {
    "no_data": -1,
    "safe": 0,
    "watch": 1,
    "warning": 2,
    "emergency": 3,
}


def is_subscription_confirmed(subscription_arn: str | None) -> bool:
    """Return whether an ARN is usable for an SNS unsubscribe request."""
    if not subscription_arn:
        return False
    return subscription_arn != PENDING_CONFIRMATION_ARN


def is_subscription_pending(subscription_arn: str | None) -> bool:
    return subscription_arn == PENDING_CONFIRMATION_ARN


def subscription_status(subscription_arn: str | None, email_alerts: bool) -> str:
    if not email_alerts or not subscription_arn:
        return SUBSCRIPTION_DISABLED
    return SUBSCRIPTION_PENDING


def _normalized_email(email: str) -> str:
    return email.strip().lower()


def _list_topic_subscriptions(topic_arn: str) -> list[dict]:
    """Return every subscription for a topic, including paginated results."""
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


def _matching_email_subscriptions(topic_arn: str, email: str) -> list[dict]:
    """Find only email subscriptions belonging to the authenticated address."""
    normalized_email = _normalized_email(email)
    return [
        subscription
        for subscription in _list_topic_subscriptions(topic_arn)
        if str(subscription.get("Protocol", "")).lower() == "email"
        and _normalized_email(str(subscription.get("Endpoint", ""))) == normalized_email
    ]


def _subscription_state(subscriptions: list[dict]) -> tuple[str, str | None]:
    """Derive SNS state from the actual topic listing, never a stored ARN."""
    confirmed = [
        str(subscription.get("SubscriptionArn"))
        for subscription in subscriptions
        if str(subscription.get("SubscriptionArn", "")).startswith("arn:aws:sns:")
    ]
    if confirmed:
        return SUBSCRIPTION_CONFIRMED, confirmed[0]
    if any(
        str(subscription.get("SubscriptionArn", "")) == PENDING_CONFIRMATION_ARN
        for subscription in subscriptions
    ):
        return SUBSCRIPTION_PENDING, PENDING_CONFIRMATION_ARN
    return SUBSCRIPTION_DISABLED, None


def get_flood_alert_subscription_status(email: str) -> tuple[str, str | None]:
    """Look up this email's real SNS state on FloodGuard-Alerts."""
    try:
        return _subscription_state(_matching_email_subscriptions(settings.sns_topic_arn, email))
    except (BotoCoreError, ClientError) as exc:
        logger.error("SNS flood-alert subscription status check failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Flood alert subscription status could not be checked.",
        ) from exc


def enable_flood_alert_subscription(email: str) -> tuple[str, str]:
    """Create at most one subscription request for this email address."""
    current_status, subscription_arn = get_flood_alert_subscription_status(email)
    if current_status != SUBSCRIPTION_DISABLED:
        return current_status, subscription_arn or PENDING_CONFIRMATION_ARN

    # SNS confirmation is asynchronous. A Subscribe response does not prove
    # the recipient has confirmed, so always report a newly requested one as
    # pending until a later topic listing proves otherwise.
    subscribe_email(_normalized_email(email))
    return SUBSCRIPTION_PENDING, PENDING_CONFIRMATION_ARN


def disable_flood_alert_subscription(email: str) -> str | None:
    """Disable this email only, retaining a pending marker for later cleanup."""
    try:
        subscriptions = _matching_email_subscriptions(settings.sns_topic_arn, email)
    except (BotoCoreError, ClientError) as exc:
        logger.error("SNS flood-alert subscription status check failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Flood alert subscription status could not be checked.",
        ) from exc

    confirmed_arns = [
        str(subscription.get("SubscriptionArn"))
        for subscription in subscriptions
        if str(subscription.get("SubscriptionArn", "")).startswith("arn:aws:sns:")
    ]
    if confirmed_arns:
        # Every ARN here was matched to the current authenticated user's exact
        # email. Removing all of them also cleans up historic duplicates.
        for subscription_arn in confirmed_arns:
            unsubscribe(subscription_arn)
        return None
    if any(str(subscription.get("SubscriptionArn", "")) == PENDING_CONFIRMATION_ARN for subscription in subscriptions):
        # SNS cannot unsubscribe PendingConfirmation ARNs. Persist this marker
        # so status reconciliation can remove it if it is confirmed later.
        return PENDING_CONFIRMATION_ARN
    return None


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

    subscription_arn = response.get("SubscriptionArn")
    if not subscription_arn:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="SNS did not return a subscription identifier.",
        )

    return subscription_arn


def unsubscribe(subscription_arn: str | None) -> None:
    """Unsubscribe a confirmed SNS email subscription."""
    if not is_subscription_confirmed(subscription_arn):
        return

    try:
        sns_client.unsubscribe(
            SubscriptionArn=subscription_arn,
        )
    except (BotoCoreError, ClientError) as exc:
        logger.error(
            "Failed to unsubscribe SNS subscription %s: %s",
            subscription_arn,
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not unsubscribe email from SNS.",
        ) from exc


def broadcast_alert(
    district: str,
    level: str,
    message: str,
) -> str:
    """Publish an official FloodGuard authority alert to the configured SNS topic."""

    formatted = build_flood_alert_message(
        severity=level,
        zone={"district": district},
        alert_source="Official FloodGuard Alert",
        optional_authority_message=message,
    )

    try:
        response = sns_client.publish(
            TopicArn=settings.sns_topic_arn,
            Subject=formatted.subject,
            Message=formatted.plain_text_body,
            MessageAttributes={
                "district": {
                    "DataType": "String",
                    "StringValue": district,
                },
                "alert_level": {
                    "DataType": "String",
                    "StringValue": level,
                },
                "alert_type": {
                    "DataType": "String",
                    "StringValue": "official_authority_alert",
                },
            },
        )
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not publish alert to SNS.",
        ) from exc

    message_id = response.get("MessageId")
    if not message_id:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="SNS did not return a message identifier.",
        )

    return message_id


def sensor_transition_requires_notification(previous_status: str | None, new_status: str) -> bool:
    """Return whether a sensor status transition merits one email notification."""
    previous = previous_status or "no_data"
    if new_status == "safe":
        return previous in {"warning", "emergency"}
    if new_status not in {"watch", "warning", "emergency"}:
        return False
    return SENSOR_SEVERITY[new_status] > SENSOR_SEVERITY.get(previous, -1)


def publish_sensor_transition(
    *,
    station_name: str,
    province: str | None,
    district: str,
    river_name: str | None,
    water_level: float,
    status: str,
    previous_status: str | None,
    watch_threshold: float | None,
    warning_threshold: float,
    danger_threshold: float,
    recorded_at=None,
) -> dict[str, str | bool]:
    """Publish one automated sensor transition through the existing SNS topic.

    A repeated reading at the same severity is intentionally a no-op. SNS
    failures are returned to the caller as metadata and never raise, because
    telemetry has already been committed successfully.
    """

    previous = previous_status or "no_data"
    if not sensor_transition_requires_notification(previous, status):
        return {
            "attempted": False,
            "published": False,
            "status": "not_sent",
            "reason": "no_severity_transition",
        }

    formatted = build_flood_alert_message(
        severity=status,
        station={
            "name": station_name,
            "province": province,
            "district": district,
            "river_name": river_name,
        },
        water_level=water_level,
        thresholds={
            "watch": watch_threshold,
            "warning": warning_threshold,
            "danger": danger_threshold,
        },
        alert_source="Automated Sensor Alert",
        timestamp=recorded_at,
    )

    try:
        response = sns_client.publish(
            TopicArn=settings.sns_topic_arn,
            Subject=formatted.subject,
            Message=formatted.plain_text_body,
            MessageAttributes={
                "alert_type": {
                    "DataType": "String",
                    "StringValue": "automated_sensor_alert",
                },
                "sensor_status": {
                    "DataType": "String",
                    "StringValue": status,
                },
                "station": {
                    "DataType": "String",
                    "StringValue": station_name[:256],
                },
            },
        )
    except (BotoCoreError, ClientError) as exc:
        logger.error(
            "SNS sensor notification failed for %s (%s -> %s): %s",
            station_name,
            previous,
            status,
            exc,
        )
        return {
            "attempted": True,
            "published": False,
            "status": "failed",
            "error": "SNS notification failed; the sensor reading was saved.",
        }

    message_id = response.get("MessageId")
    if not message_id:
        logger.error("SNS sensor notification returned no message ID for %s", station_name)
        return {
            "attempted": True,
            "published": False,
            "status": "failed",
            "error": "SNS notification returned no message ID; the sensor reading was saved.",
        }

    return {
        "attempted": True,
        "published": True,
        "status": "published",
        "message_id": message_id,
    }
