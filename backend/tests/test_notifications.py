from unittest.mock import MagicMock

import pytest
from botocore.exceptions import ClientError
from fastapi import HTTPException

from models.alert import AlertLevel, AlertZone, FloodAlert
from models.user import User, UserRole
from routers import authority as authority_router
from routers import auth as auth_router
from routers.auth import hash_password
from schemas.alert import BroadcastRequest
from schemas.user import UserUpdate
from services import sns_service


def make_user(db, name, email, role):
    user = User(
        name=name,
        email=email,
        password_hash=hash_password("Password123!"),
        role=role,
        email_alerts=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_pending_subscription_is_not_unsubscribed(monkeypatch):
    sns_client = MagicMock()
    monkeypatch.setattr(sns_service, "sns_client", sns_client)

    assert sns_service.is_subscription_pending("PendingConfirmation")
    sns_service.unsubscribe("PendingConfirmation")
    sns_client.unsubscribe.assert_not_called()


def test_sns_failures_become_http_errors(monkeypatch):
    sns_client = MagicMock()
    failure = ClientError(
        {"Error": {"Code": "AccessDenied", "Message": "denied"}},
        "Publish",
    )
    sns_client.publish.side_effect = failure
    monkeypatch.setattr(sns_service, "sns_client", sns_client)

    with pytest.raises(HTTPException) as exc:
        sns_service.broadcast_alert("Kathmandu", "warning", "Water rising")
    assert exc.value.status_code == 502


def test_profile_subscription_state_is_persisted(db, monkeypatch):
    user = make_user(db, "Public", "public@example.com", UserRole.public)
    subscribe = MagicMock(return_value="arn:aws:sns:us-east-1:123456789012:test-subscription")
    monkeypatch.setattr(auth_router, "subscribe_email", subscribe)

    result = auth_router.update_profile(UserUpdate(email_alerts=True), user, db)
    subscribe.assert_called_once_with("public@example.com")
    assert result["user"].email_alerts is True
    assert result["user"].email_alert_status == "pending"
    assert "confirm" in result["message"].lower()
    assert "confirmed" not in result["message"].lower()


def test_email_alerts_do_not_enable_password_recovery(db, monkeypatch):
    user = make_user(db, "Public", "alerts-only@example.com", UserRole.public)
    enable_recovery = MagicMock()
    monkeypatch.setattr(auth_router, "enable_password_reset_subscription", enable_recovery)
    monkeypatch.setattr(auth_router, "subscribe_email", lambda email: "PendingConfirmation")

    result = auth_router.update_profile(UserUpdate(email_alerts=True), user, db)

    assert result["user"].email_alerts is True
    assert result["user"].password_recovery_enabled is False
    enable_recovery.assert_not_called()


def test_enabling_password_recovery_is_independent_and_pending(db, monkeypatch):
    user = make_user(db, "Public", "recovery@example.com", UserRole.public)
    enable_recovery = MagicMock(
        return_value=(
            "arn:aws:sns:us-east-1:123456789012:private-reset-topic",
            "PendingConfirmation",
            "pending",
        )
    )
    monkeypatch.setattr(auth_router, "enable_password_reset_subscription", enable_recovery)

    result = auth_router.update_profile(UserUpdate(password_recovery_enabled=True), user, db)

    enable_recovery.assert_called_once_with(user.email)
    assert result["user"].email_alerts is False
    assert result["user"].password_recovery_enabled is True
    assert result["user"].password_recovery_status == "pending"
    assert "pending confirmation" in result["message"].lower()


def test_check_status_promotes_confirmed_password_recovery(db, monkeypatch):
    user = make_user(db, "Public", "confirmed-recovery@example.com", UserRole.public)
    user.password_recovery_enabled = True
    user.password_recovery_topic_arn = "arn:aws:sns:us-east-1:123456789012:private-reset-topic"
    user.password_recovery_subscription_arn = "PendingConfirmation"
    db.commit()
    monkeypatch.setattr(
        auth_router,
        "get_password_reset_subscription_status",
        lambda topic, email: ("confirmed", f"{topic}:confirmed"),
    )

    result = auth_router.check_password_recovery_status(user, db)

    assert result["user"].password_recovery_status == "confirmed"
    assert result["user"].password_recovery_subscription_arn.endswith(":confirmed")


def test_disabling_password_recovery_does_not_change_alerts(db, monkeypatch):
    user = make_user(db, "Public", "independent@example.com", UserRole.public)
    user.email_alerts = True
    user.sns_subscription_arn = "alert-subscription"
    user.password_recovery_enabled = True
    user.password_recovery_topic_arn = "private-topic"
    user.password_recovery_subscription_arn = "recovery-subscription"
    db.commit()
    unsubscribe_recovery = MagicMock()
    monkeypatch.setattr(auth_router, "unsubscribe_password_reset_subscription", unsubscribe_recovery)

    result = auth_router.update_profile(UserUpdate(password_recovery_enabled=False), user, db)

    unsubscribe_recovery.assert_called_once_with("recovery-subscription")
    assert result["user"].email_alerts is True
    assert result["user"].sns_subscription_arn == "alert-subscription"
    assert result["user"].password_recovery_enabled is False


def test_subscribe_success_does_not_claim_confirmation(monkeypatch):
    sns_client = MagicMock()
    sns_client.subscribe.return_value = {
        "SubscriptionArn": "arn:aws:sns:us-east-1:123456789012:test-subscription"
    }
    monkeypatch.setattr(sns_service, "sns_client", sns_client)

    subscription_arn = sns_service.subscribe_email("public@example.com")
    assert subscription_arn.startswith("arn:")
    assert sns_service.subscription_status(subscription_arn, True) == "pending"


def test_disabling_pending_email_alerts_is_safe(db, monkeypatch):
    user = make_user(db, "Public", "pending@example.com", UserRole.public)
    user.email_alerts = True
    user.sns_subscription_arn = "PendingConfirmation"
    db.commit()
    sns_client = MagicMock()
    monkeypatch.setattr(sns_service, "sns_client", sns_client)

    result = auth_router.update_profile(UserUpdate(email_alerts=False), user, db)
    assert result["user"].email_alerts is False
    assert result["user"].sns_subscription_arn is None
    sns_client.unsubscribe.assert_not_called()


def test_disabling_confirmed_email_alerts_unsubscribes(db, monkeypatch):
    user = make_user(db, "Public", "confirmed@example.com", UserRole.public)
    user.email_alerts = True
    user.sns_subscription_arn = "arn:aws:sns:us-east-1:123456789012:confirmed-subscription"
    db.commit()
    sns_client = MagicMock()
    monkeypatch.setattr(sns_service, "sns_client", sns_client)

    result = auth_router.update_profile(UserUpdate(email_alerts=False), user, db)
    assert result["user"].email_alerts is False
    assert result["user"].sns_subscription_arn is None
    sns_client.unsubscribe.assert_called_once_with(
        SubscriptionArn="arn:aws:sns:us-east-1:123456789012:confirmed-subscription"
    )


def test_authority_broadcast_stores_sns_message_id(db, monkeypatch):
    authority = make_user(db, "Authority", "authority@example.com", UserRole.authority)
    zone = AlertZone(
        district="Kathmandu",
        alert_level=AlertLevel.safe,
        latitude=27.7,
        longitude=85.3,
    )
    db.add(zone)
    db.commit()
    db.refresh(zone)
    monkeypatch.setattr(authority_router, "broadcast_alert", lambda **kwargs: "sns-123")

    result = authority_router.broadcast_zone_alert(
        BroadcastRequest(zone_id=zone.id, alert_level=AlertLevel.warning, message="Water rising"),
        authority,
        db,
    )
    assert result.sns_message_id == "sns-123"
    stored = db.query(FloodAlert).one()
    assert stored.sns_message_id == "sns-123"
