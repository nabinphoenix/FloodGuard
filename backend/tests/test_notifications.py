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
    monkeypatch.setattr(auth_router, "subscribe_email", lambda email: "PendingConfirmation")

    result = auth_router.update_profile(UserUpdate(email_alerts=True), user, db)
    assert result["user"].email_alerts is True
    assert result["user"].email_alert_status == "pending"
    assert result["message"]


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
