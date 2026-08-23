"""Presentation-safe monitoring values derived from persisted sensor readings."""

from __future__ import annotations

from datetime import datetime, timezone


FRESH_SECONDS = 2 * 60
DELAYED_SECONDS = 5 * 60


def reading_freshness(
    recorded_at: datetime | None,
    *,
    now: datetime | None = None,
) -> str:
    """Classify reading age without changing its flood-threshold status."""

    if recorded_at is None:
        return "no_reading"

    reference = now or datetime.now(timezone.utc)
    timestamp = recorded_at if recorded_at.tzinfo else recorded_at.replace(tzinfo=timezone.utc)
    if reference.tzinfo is None:
        reference = reference.replace(tzinfo=timezone.utc)
    age_seconds = max(0, (reference - timestamp).total_seconds())
    if age_seconds < FRESH_SECONDS:
        return "fresh"
    if age_seconds <= DELAYED_SECONDS:
        return "delayed"
    return "stale"


def water_level_trend(current: float | None, previous: float | None) -> str:
    """Describe the direction between the two most recent readings."""

    if current is None or previous is None:
        return "unavailable"
    if current > previous:
        return "rising"
    if current < previous:
        return "falling"
    return "steady"
