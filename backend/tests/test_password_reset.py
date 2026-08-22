from datetime import timedelta
from unittest.mock import MagicMock
from urllib.parse import parse_qs, urlparse

import pytest

from models.password_reset import PasswordResetToken
from models.user import User, UserRole
from routers import auth as auth_router
from routers.auth import hash_password
from services import email_service
from services.password_reset_service import (
    clear_reset_rate_limits,
    issue_reset_token,
    utc_now,
)


def make_user(db, email="reset-user@example.com", role=UserRole.public):
    user = User(
        name="Reset User",
        email=email,
        password_hash=hash_password("OldPassword123!"),
        role=role,
        email_alerts=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture(autouse=True)
def reset_rate_limits():
    clear_reset_rate_limits()
    yield
    clear_reset_rate_limits()


def test_forgot_password_response_is_generic_for_known_and_unknown_accounts(client, db, monkeypatch):
    test_client, _ = client
    user = make_user(db)
    sent = []
    monkeypatch.setattr(auth_router, "ensure_password_reset_subscription", lambda _email: True)
    monkeypatch.setattr(
        auth_router,
        "send_password_reset_email",
        lambda recipient, url: sent.append((recipient, url)) or "sns-message-id",
    )

    known = test_client.post("/api/auth/forgot-password", json={"email": user.email})
    unknown = test_client.post("/api/auth/forgot-password", json={"email": "nobody@example.com"})

    expected = (
        "If an account exists for this email, check your inbox for a reset link or an SNS subscription "
        "confirmation. After confirming a new subscription, request the reset link again."
    )
    assert known.status_code == 202
    assert unknown.status_code == 202
    assert known.json() == {"message": expected}
    assert unknown.json() == {"message": expected}
    assert sent and sent[0][0] == user.email


def test_forgot_password_requests_sns_confirmation_before_issuing_a_token(client, db, monkeypatch):
    test_client, _ = client
    user = make_user(db, email="pending-reset@example.com")
    sent = []
    monkeypatch.setattr(auth_router, "ensure_password_reset_subscription", lambda _email: None)
    monkeypatch.setattr(
        auth_router,
        "send_password_reset_email",
        lambda recipient, url: sent.append((recipient, url)),
    )

    response = test_client.post("/api/auth/forgot-password", json={"email": user.email})

    assert response.status_code == 202
    assert sent == []
    assert db.query(PasswordResetToken).count() == 0

def test_reset_token_is_hashed_single_use_and_invalidates_old_password_and_jwt(client, db, monkeypatch):
    test_client, _ = client
    user = make_user(db)
    sent = []
    monkeypatch.setattr(auth_router, "ensure_password_reset_subscription", lambda _email: True)
    monkeypatch.setattr(
        auth_router,
        "send_password_reset_email",
        lambda recipient, url: sent.append(url) or "sns-message-id",
    )

    old_login = test_client.post(
        "/api/auth/login",
        json={"email": user.email, "password": "OldPassword123!"},
    )
    old_token = old_login.json()["access_token"]
    response = test_client.post("/api/auth/forgot-password", json={"email": user.email})
    assert response.status_code == 202
    raw_token = parse_qs(urlparse(sent[0]).query)["token"][0]
    stored = db.query(PasswordResetToken).one()
    assert stored.token_hash != raw_token
    assert raw_token not in str(stored.__dict__)

    reset = test_client.post(
        "/api/auth/reset-password",
        json={"token": raw_token, "new_password": "NewPassword456!"},
    )
    assert reset.status_code == 200
    assert db.query(PasswordResetToken).one().used_at is not None

    old_password_login = test_client.post(
        "/api/auth/login",
        json={"email": user.email, "password": "OldPassword123!"},
    )
    new_password_login = test_client.post(
        "/api/auth/login",
        json={"email": user.email, "password": "NewPassword456!"},
    )
    assert old_password_login.status_code == 401
    assert new_password_login.status_code == 200

    with pytest.raises(Exception) as old_session:
        auth_router.get_current_user(old_token, db)
    assert old_session.value.status_code == 401

    reused = test_client.post(
        "/api/auth/reset-password",
        json={"token": raw_token, "new_password": "AnotherPassword789!"},
    )
    assert reused.status_code == 400
    assert "invalid or has expired" in reused.json()["detail"]


def test_invalid_and_expired_reset_tokens_are_safe_errors(client, db):
    test_client, _ = client
    user = make_user(db, email="expired-reset@example.com")
    raw_token, record = issue_reset_token(db, user, "127.0.0.1")
    record.expires_at = utc_now() - timedelta(minutes=1)
    db.commit()

    expired = test_client.post(
        "/api/auth/reset-password",
        json={"token": raw_token, "new_password": "NewPassword456!"},
    )
    invalid = test_client.post(
        "/api/auth/reset-password",
        json={"token": "invalid-reset-token-1234567890", "new_password": "NewPassword456!"},
    )
    assert expired.status_code == 400
    assert invalid.status_code == 400
    assert expired.json()["detail"] == invalid.json()["detail"]


def test_private_sns_topic_requests_confirmation_then_sends_only_to_recipient(monkeypatch):
    recipient = "citizen@example.com"
    topic_arn = "arn:aws:sns:us-east-1:123456789012:private-reset-topic"
    subscription_arn = f"{topic_arn}:confirmed-subscription"
    sns = MagicMock()
    sns.create_topic.return_value = {"TopicArn": topic_arn}
    sns.list_subscriptions_by_topic.side_effect = [
        {"Subscriptions": []},
        {
            "Subscriptions": [
                {
                    "SubscriptionArn": subscription_arn,
                    "Protocol": "email",
                    "Endpoint": recipient,
                    "TopicArn": topic_arn,
                }
            ]
        },
    ]
    sns.subscribe.return_value = {"SubscriptionArn": f"{topic_arn}:pending-subscription"}
    sns.get_subscription_attributes.return_value = {
        "Attributes": {"PendingConfirmation": "false"}
    }
    sns.publish.return_value = {"MessageId": "sns-reset-123"}
    monkeypatch.setattr(email_service, "sns_client", sns)

    assert email_service.ensure_password_reset_subscription(recipient) is None
    sns.subscribe.assert_called_once_with(
        TopicArn=topic_arn,
        Protocol="email",
        Endpoint=recipient,
        ReturnSubscriptionArn=True,
    )

    message_id = email_service.send_password_reset_email(
        recipient,
        "https://floodguard.example/reset-password?token=private-token",
    )

    assert message_id == "sns-reset-123"
    topic_name = sns.create_topic.call_args_list[0].kwargs["Name"]
    assert recipient not in topic_name
    publish = sns.publish.call_args.kwargs
    assert publish["TopicArn"] == topic_arn
    assert publish["Subject"] == "Reset your FloodGuard password"
    assert "private-token" in publish["Message"]


def test_private_sns_topic_does_not_publish_while_confirmation_is_pending(monkeypatch):
    recipient = "pending-citizen@example.com"
    topic_arn = "arn:aws:sns:us-east-1:123456789012:private-reset-topic"
    subscription_arn = f"{topic_arn}:pending-subscription"
    sns = MagicMock()
    sns.create_topic.return_value = {"TopicArn": topic_arn}
    sns.list_subscriptions_by_topic.return_value = {
        "Subscriptions": [
            {
                "SubscriptionArn": subscription_arn,
                "Protocol": "email",
                "Endpoint": recipient,
                "TopicArn": topic_arn,
            }
        ]
    }
    sns.get_subscription_attributes.return_value = {
        "Attributes": {"PendingConfirmation": "true"}
    }
    sns.subscribe.return_value = {"SubscriptionArn": subscription_arn}
    monkeypatch.setattr(email_service, "sns_client", sns)

    with pytest.raises(email_service.EmailSubscriptionPending):
        email_service.send_password_reset_email(
            recipient,
            "https://floodguard.example/reset-password?token=private-token",
        )

    sns.publish.assert_not_called()


def test_private_sns_topic_refuses_any_unexpected_subscriber(monkeypatch):
    topic_arn = "arn:aws:sns:us-east-1:123456789012:private-reset-topic"
    sns = MagicMock()
    sns.create_topic.return_value = {"TopicArn": topic_arn}
    sns.list_subscriptions_by_topic.return_value = {
        "Subscriptions": [
            {
                "SubscriptionArn": f"{topic_arn}:unexpected",
                "Protocol": "email",
                "Endpoint": "someone-else@example.com",
                "TopicArn": topic_arn,
            }
        ]
    }
    monkeypatch.setattr(email_service, "sns_client", sns)

    with pytest.raises(email_service.EmailDeliveryError):
        email_service.send_password_reset_email(
            "citizen@example.com",
            "https://floodguard.example/reset-password?token=private-token",
        )

    sns.publish.assert_not_called()
