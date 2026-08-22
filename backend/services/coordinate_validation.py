"""Shared coordinate validation for FloodGuard's Nepal operations."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class CoordinateBounds:
    """A broad operational envelope, rather than a replacement for a border polygon."""

    south: float
    north: float
    west: float
    east: float


# The envelope includes Nepal and a small amount of surrounding context for
# field collection, while rejecting the clearly unrelated production points.
NEPAL_OPERATIONAL_BOUNDS = CoordinateBounds(
    south=25.5,
    north=31.0,
    west=79.5,
    east=89.0,
)


def is_valid_coordinate(latitude: Any, longitude: Any) -> bool:
    """Return True only for finite latitude/longitude values on Earth."""

    try:
        lat = float(latitude)
        lng = float(longitude)
    except (TypeError, ValueError):
        return False

    return (
        math.isfinite(lat)
        and math.isfinite(lng)
        and -90 <= lat <= 90
        and -180 <= lng <= 180
    )


def is_within_nepal_operational_bounds(latitude: Any, longitude: Any) -> bool:
    """Return True when a coordinate is valid and inside FloodGuard's Nepal envelope."""

    if not is_valid_coordinate(latitude, longitude):
        return False

    lat = float(latitude)
    lng = float(longitude)
    bounds = NEPAL_OPERATIONAL_BOUNDS
    return bounds.south <= lat <= bounds.north and bounds.west <= lng <= bounds.east


def coordinate_validation_error(
    latitude: Any,
    longitude: Any,
    *,
    label: str = "Location",
    allow_none: bool = False,
) -> str | None:
    """Return a user-facing validation message, or None when the pair is valid."""

    missing_latitude = latitude is None
    missing_longitude = longitude is None
    if missing_latitude or missing_longitude:
        if allow_none and missing_latitude and missing_longitude:
            return None
        return f"{label} latitude and longitude must be provided together."

    if not is_valid_coordinate(latitude, longitude):
        return f"{label} must use valid latitude and longitude coordinates."

    if not is_within_nepal_operational_bounds(latitude, longitude):
        return f"{label} must be within Nepal's operational area."

    return None
