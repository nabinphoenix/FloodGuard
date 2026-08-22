from datetime import timedelta
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
    monkeypatch.setattr(
        auth_router,
        "send_password_reset_email",
        lambda recipient, url: sent.append((recipient, url)) or "ses-message-id",
    )

    known = test_client.post("/api/auth/forgot-password", json={"email": user.email})
    unknown = test_client.post("/api/auth/forgot-password", json={"email": "nobody@example.com"})

    expected = "If an account exists for this email, a password reset link has been sent."
    assert known.status_code == 202
    assert unknown.status_code == 202
    assert known.json() == {"message": expected}
    assert unknown.json() == {"message": expected}
    assert sent and sent[0][0] == user.email


def test_reset_token_is_hashed_single_use_and_invalidates_old_password_and_jwt(client, db, monkeypatch):
    test_client, _ = client
    user = make_user(db)
    sent = []
    monkeypatch.setattr(
        auth_router,
        "send_password_reset_email",
        lambda recipient, url: sent.append(url) or "ses-message-id",
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


def test_reset_flow_supports_admin_role_and_ses_is_private(monkeypatch):
    calls = []
    monkeypatch.setattr(email_service.settings, "ses_from_email", "no-reply@floodguard.example")
    monkeypatch.setattr(
        email_service.ses_client,
        "send_email",
        lambda **kwargs: calls.append(kwargs) or {"MessageId": "ses-123"},
    )

    message_id = email_service.send_password_reset_email(
        "admin@example.com",
        "https://floodguard.example/reset-password?token=private-token",
    )

    assert message_id == "ses-123"
    assert calls[0]["Destination"] == {"ToAddresses": ["admin@example.com"]}
    assert "private-token" in calls[0]["Message"]["Body"]["Text"]["Data"]
    assert calls[0]["Message"]["Subject"]["Data"] == "Reset your FloodGuard password"
