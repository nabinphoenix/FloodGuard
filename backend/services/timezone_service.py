"""FloodGuard's user-facing timezone helpers.

Persisted timestamps and machine-to-machine events remain UTC instants. These
helpers convert them only at presentation boundaries so Kathmandu displays are
consistent without changing expiry calculations or event ordering.
"""

from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo


KATHMANDU_TIMEZONE = ZoneInfo("Asia/Kathmandu")


def to_kathmandu(value: datetime) -> datetime:
    """Return a timezone-aware Kathmandu representation of an instant."""
    timestamp = value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
    return timestamp.astimezone(KATHMANDU_TIMEZONE)


def kathmandu_isoformat(value: datetime) -> str:
    return to_kathmandu(value).isoformat()
