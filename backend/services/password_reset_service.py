from __future__ import annotations

import hashlib
import secrets
import threading
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from config import settings
from models.password_reset import PasswordResetToken
from models.user import User


GENERIC_RESET_MESSAGE = (
    "If an account exists for this email, check your inbox for a reset link or an SNS subscription "
    "confirmation. After confirming a new subscription, request the reset link again."
)
INVALID_RESET_MESSAGE = "This password reset link is invalid or has expired."

_rate_limit_lock = threading.Lock()
_rate_limit_seen: dict[str, float] = {}


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def hash_reset_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _rate_limit_keys(email: str, client_ip: str | None) -> tuple[str, ...]:
    keys = [f"email:{email.strip().lower()}"]
    if client_ip:
        keys.append(f"ip:{client_ip.strip()}")
    return tuple(keys)


def is_reset_rate_limited(email: str, client_ip: str | None) -> bool:
    now = time.monotonic()
    with _rate_limit_lock:
        return any(
            now - _rate_limit_seen.get(key, float("-inf"))
            < max(1, settings.password_reset_rate_limit_seconds)
            for key in _rate_limit_keys(email, client_ip)
        )


def record_reset_request(email: str, client_ip: str | None) -> None:
    now = time.monotonic()
    with _rate_limit_lock:
        for key in _rate_limit_keys(email, client_ip):
            _rate_limit_seen[key] = now


def clear_reset_rate_limits() -> None:
    """Clear process-local throttling state for isolated tests and workers."""
    with _rate_limit_lock:
        _rate_limit_seen.clear()


def issue_reset_token(
    db: Session,
    user: User,
    request_ip: str | None,
) -> tuple[str, PasswordResetToken]:
    now = utc_now()
    db.execute(
        update(PasswordResetToken)
        .where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
        )
        .values(used_at=now)
    )

    raw_token = secrets.token_urlsafe(32)
    record = PasswordResetToken(
        user_id=user.id,
        token_hash=hash_reset_token(raw_token),
        expires_at=now + timedelta(minutes=max(15, min(30, settings.password_reset_token_minutes))),
        request_ip=request_ip[:64] if request_ip else None,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return raw_token, record


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def get_valid_reset_token(
    db: Session,
    raw_token: str,
    now: datetime | None = None,
) -> PasswordResetToken | None:
    record = db.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == hash_reset_token(raw_token)
        )
    )
    if record is None or record.used_at is not None:
        return None
    current = _as_utc(now or utc_now())
    if _as_utc(record.expires_at) <= current:
        return None
    return record


def build_reset_url(raw_token: str) -> str:
    base_url = settings.frontend_base_url.rstrip("/")
    return f"{base_url}/reset-password?{urlencode({'token': raw_token})}"
