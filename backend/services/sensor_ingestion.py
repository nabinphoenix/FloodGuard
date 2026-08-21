"""Shared sensor-reading processing for manual and device ingestion."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from models.sensor import SensorReading, SensorStation

logger = logging.getLogger(__name__)


class SensorStationNotFoundError(LookupError):
    pass


class SensorStationInactiveError(ValueError):
    pass


class InvalidSensorTimestampError(ValueError):
    pass


@dataclass(frozen=True)
class SensorIngestionResult:
    station: SensorStation
    reading: SensorReading
    previous_status: str
    current_status: str
    notification: dict
    queue: dict
    source: str


def classify_water_level(
    water_level: float | None,
    watch_threshold: float | None,
    warning_threshold: float,
    danger_threshold: float,
) -> str:
    if water_level is None:
        return "no_data"
    if water_level >= danger_threshold:
        return "emergency"
    if water_level >= warning_threshold:
        return "warning"
    if watch_threshold is not None and water_level >= watch_threshold:
        return "watch"
    return "safe"


def effective_watch_threshold(station: SensorStation) -> float | None:
    if station.watch_threshold is not None:
        return station.watch_threshold
    if station.warning_threshold > 0:
        return max(0.0, station.warning_threshold - 1.0)
    return None


def station_status(station: SensorStation, water_level: float | None) -> str:
    return classify_water_level(
        water_level,
        effective_watch_threshold(station),
        station.warning_threshold,
        station.danger_threshold,
    )


def parse_sensor_timestamp(raw: str | None) -> datetime:
    if not raw:
        return datetime.now(timezone.utc)
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError as exc:
        raise InvalidSensorTimestampError(
            "timestamp must be a valid ISO-8601 timestamp."
        ) from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def process_sensor_reading(
    db: Session,
    station_code: str,
    water_level: float,
    *,
    timestamp: str | None = None,
    source: str = "manual",
    notification_publisher,
    queue_sender,
) -> SensorIngestionResult:
    """Persist one reading and run the existing notification integrations.

    The reading is committed before SNS/SQS delivery is attempted. Callers
    supply the integrations so the manual and device routes share this exact
    business flow while remaining straightforward to test.
    """
    station = db.get(SensorStation, station_code)
    if station is None:
        raise SensorStationNotFoundError(station_code)
    if not station.is_active:
        raise SensorStationInactiveError(station_code)

    previous_reading = db.scalars(
        select(SensorReading)
        .where(SensorReading.station_id == station.id)
        .order_by(SensorReading.recorded_at.desc(), SensorReading.id.desc())
        .limit(1)
    ).first()
    previous_status = (
        previous_reading.status
        if previous_reading and previous_reading.status
        else station_status(station, previous_reading.water_level)
        if previous_reading
        else "no_data"
    )
    current_status = station_status(station, water_level)
    db_reading = SensorReading(
        station_id=station.id,
        water_level=water_level,
        status=current_status,
        recorded_at=parse_sensor_timestamp(timestamp),
    )
    db.add(db_reading)
    db.commit()
    db.refresh(db_reading)

    try:
        notification = notification_publisher(
            station_name=station.name,
            province=station.province,
            district=station.district,
            river_name=station.river_name,
            water_level=db_reading.water_level,
            status=current_status,
            previous_status=previous_status,
            watch_threshold=effective_watch_threshold(station),
            warning_threshold=station.warning_threshold,
            danger_threshold=station.danger_threshold,
        )
    except Exception as exc:
        logger.error("Sensor SNS notification failed after reading save for %s: %s", station.id, exc)
        notification = {
            "attempted": True,
            "published": False,
            "status": "failed",
            "error": "SNS notification failed; the sensor reading was saved.",
        }

    queue_status: dict[str, str | bool] = {"queued": False, "status": "failed"}
    try:
        queue_sender(
            {
                "station_id": station.id,
                "station_code": station.id,
                "name": station.name,
                "province": station.province,
                "district": station.district,
                "river_basin": station.river_basin,
                "river_name": station.river_name,
                "water_level": db_reading.water_level,
                "status": current_status,
                "watch_threshold": effective_watch_threshold(station),
                "warning_threshold": station.warning_threshold,
                "danger_threshold": station.danger_threshold,
                "timestamp": db_reading.recorded_at.isoformat(),
                "previous_status": previous_status,
                "source": source,
            }
        )
        queue_status = {"queued": True, "status": "queued"}
    except Exception as exc:
        logger.error("Failed to dispatch sensor reading to SQS for station %s: %s", station.id, exc)
        queue_status = {
            "queued": False,
            "status": "failed",
            "error": "SQS dispatch failed; the sensor reading was saved.",
        }

    logger.info(
        "Processed sensor reading for station %s from source %s as %s",
        station.id,
        source,
        current_status,
    )
    return SensorIngestionResult(
        station=station,
        reading=db_reading,
        previous_status=previous_status,
        current_status=current_status,
        notification=notification,
        queue=queue_status,
        source=source,
    )
