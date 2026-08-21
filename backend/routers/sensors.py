"""Sensor API for live water-level monitoring.

Sensor readings are stored in the relational database. Public live monitoring
remains available through GET /api/sensors/live; operational configuration,
history, ingestion, and health remain role protected.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models.alert import AlertLevel, AlertZone
from models.sensor import SensorReading, SensorStation
from models.user import UserRole
from routers.auth import require_any_role
from services.sqs_service import send_sensor_reading, sqs_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sensors", tags=["sensors"])


class SensorReadingIn(BaseModel):
    station_id: str = Field(..., min_length=1, max_length=20)
    water_level: float = Field(..., ge=0)
    timestamp: str | None = None


class ThresholdUpdate(BaseModel):
    # Optional for backward-compatible clients; new clients send all three.
    watch_threshold: float | None = Field(default=None, ge=0)
    warning_threshold: float = Field(..., ge=0)
    danger_threshold: float = Field(..., ge=0)


def effective_watch_threshold(station: SensorStation) -> float | None:
    if station.watch_threshold is not None:
        return station.watch_threshold
    if station.warning_threshold > 0:
        return max(0.0, station.warning_threshold - 1.0)
    return None


def alert_level_for_reading(water_level: float, station: SensorStation) -> AlertLevel:
    watch_threshold = effective_watch_threshold(station)
    if water_level >= station.danger_threshold:
        return AlertLevel.emergency
    if water_level >= station.warning_threshold:
        return AlertLevel.warning
    if watch_threshold is not None and water_level >= watch_threshold:
        return AlertLevel.watch
    return AlertLevel.safe


def reading_to_dict(reading: SensorReading, district: str | None = None) -> dict:
    return {
        "station_id": reading.station_id,
        "water_level": reading.water_level,
        "timestamp": reading.recorded_at.isoformat(),
        "district": district,
    }


def station_to_dict(station: SensorStation, latest: dict | None = None) -> dict:
    water_level = latest.get("water_level") if latest else None
    status_level = "no_data"
    if water_level is not None:
        status_level = alert_level_for_reading(water_level, station).value

    return {
        "id": station.id,
        "name": station.name,
        "station_code": station.id,
        "station_name": station.name,
        "province": station.province,
        "district": station.district,
        "river_basin": station.river_basin,
        "river_name": station.river_name,
        "latitude": station.latitude,
        "longitude": station.longitude,
        "watch_threshold": effective_watch_threshold(station),
        "warning_threshold": station.warning_threshold,
        "danger_threshold": station.danger_threshold,
        "is_active": station.is_active,
        "created_at": station.created_at,
        "latest_reading": latest,
        "status": status_level,
    }


def _parse_timestamp(raw: str | None) -> datetime:
    if not raw:
        return datetime.now(timezone.utc)
    try:
        parsed = datetime.fromisoformat(raw)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed
    except ValueError:
        return datetime.now(timezone.utc)


def _latest_per_station(db: Session, station_ids: list[str]) -> dict[str, dict]:
    if not station_ids:
        return {}

    subquery = (
        select(
            SensorReading.station_id,
            func.max(SensorReading.recorded_at).label("max_recorded_at"),
        )
        .where(SensorReading.station_id.in_(station_ids))
        .group_by(SensorReading.station_id)
        .subquery()
    )
    rows = db.scalars(
        select(SensorReading).join(
            subquery,
            (SensorReading.station_id == subquery.c.station_id)
            & (SensorReading.recorded_at == subquery.c.max_recorded_at),
        )
    ).all()
    return {row.station_id: reading_to_dict(row) for row in rows}


def sync_zone_level(db: Session, station: SensorStation, level: AlertLevel) -> None:
    zone = db.scalar(
        select(AlertZone).where(func.lower(AlertZone.district) == station.district.lower())
    )
    if zone is None:
        zone = AlertZone(
            district=station.district,
            alert_level=level,
            latitude=station.latitude,
            longitude=station.longitude,
        )
    else:
        zone.alert_level = level
        zone.updated_at = datetime.now(timezone.utc)
    db.add(zone)
    db.commit()


@router.post(
    "/reading",
    dependencies=[Depends(require_any_role(UserRole.field_officer, UserRole.admin))],
)
def receive_sensor_reading(reading: SensorReadingIn, db: Session = Depends(get_db)) -> dict:
    station = db.get(SensorStation, reading.station_id)
    if station is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor station not found.")
    if not station.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sensor station is inactive.")

    previous_reading = db.scalars(
        select(SensorReading)
        .where(SensorReading.station_id == station.id)
        .order_by(SensorReading.recorded_at.desc())
        .limit(1)
    ).first()
    previous_alert_level = (
        alert_level_for_reading(previous_reading.water_level, station).value
        if previous_reading
        else "safe"
    )

    db_reading = SensorReading(
        station_id=station.id,
        water_level=reading.water_level,
        recorded_at=_parse_timestamp(reading.timestamp),
    )
    db.add(db_reading)
    db.commit()
    db.refresh(db_reading)

    saved = reading_to_dict(db_reading, district=station.district)
    zone_level = alert_level_for_reading(reading.water_level, station)
    sync_zone_level(db, station, zone_level)

    try:
        send_sensor_reading(
            {
                "station_id": station.id,
                "name": station.name,
                "province": station.province,
                "district": station.district,
                "river_basin": station.river_basin,
                "river_name": station.river_name,
                "water_level": db_reading.water_level,
                "watch_threshold": effective_watch_threshold(station),
                "warning_threshold": station.warning_threshold,
                "danger_threshold": station.danger_threshold,
                "timestamp": db_reading.recorded_at.isoformat(),
                "previous_alert_level": previous_alert_level,
                "current_alert_level": zone_level.value,
            }
        )
    except Exception as exc:
        logger.error("Failed to dispatch sensor reading to SQS for station %s: %s", station.id, exc)

    return {
        "message": "Sensor reading saved.",
        "reading": saved,
        "station": station_to_dict(station, saved),
        "alert_level": zone_level.value,
    }


@router.get("/live")
def get_live_readings(db: Session = Depends(get_db)) -> list[dict]:
    stations = db.scalars(
        select(SensorStation)
        .where(SensorStation.is_active == True)  # noqa: E712
        .order_by(SensorStation.id.asc())
    ).all()
    latest_by_station = _latest_per_station(db, [station.id for station in stations])
    return [station_to_dict(station, latest_by_station.get(station.id)) for station in stations]


@router.get(
    "/history/{station_id}",
    dependencies=[Depends(require_any_role(UserRole.field_officer, UserRole.admin))],
)
def get_history(
    station_id: str,
    limit: int = Query(default=48, ge=1, le=200),
    db: Session = Depends(get_db),
) -> dict:
    station = db.get(SensorStation, station_id)
    if station is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor station not found.")
    rows = db.scalars(
        select(SensorReading)
        .where(SensorReading.station_id == station_id)
        .order_by(SensorReading.recorded_at.desc())
        .limit(limit)
    ).all()
    return {
        "station": station_to_dict(station),
        "readings": [
            reading_to_dict(row, district=station.district)
            for row in reversed(rows)
        ],
    }


@router.get(
    "/stations",
    dependencies=[Depends(require_any_role(UserRole.field_officer, UserRole.admin))],
)
def get_stations(db: Session = Depends(get_db)) -> list[dict]:
    stations = db.scalars(select(SensorStation).order_by(SensorStation.id.asc())).all()
    latest_by_station = _latest_per_station(db, [station.id for station in stations])
    return [station_to_dict(station, latest_by_station.get(station.id)) for station in stations]


@router.put(
    "/stations/{station_id}/thresholds",
    dependencies=[Depends(require_any_role(UserRole.field_officer, UserRole.admin))],
)
def update_thresholds(
    station_id: str,
    payload: ThresholdUpdate,
    db: Session = Depends(get_db),
) -> dict:
    station = db.get(SensorStation, station_id)
    if station is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor station not found.")

    watch_threshold = (
        payload.watch_threshold
        if payload.watch_threshold is not None
        else effective_watch_threshold(station)
    )
    if watch_threshold is None or watch_threshold >= payload.warning_threshold:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Watch threshold must be less than warning threshold.",
        )
    if payload.warning_threshold >= payload.danger_threshold:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Warning threshold must be less than emergency threshold.",
        )

    station.watch_threshold = watch_threshold
    station.warning_threshold = payload.warning_threshold
    station.danger_threshold = payload.danger_threshold
    db.add(station)
    db.commit()
    db.refresh(station)

    latest = _latest_per_station(db, [station_id])
    return station_to_dict(station, latest.get(station_id))


@router.get(
    "/health",
    dependencies=[Depends(require_any_role(UserRole.field_officer, UserRole.admin))],
)
def get_sensor_health(db: Session = Depends(get_db)) -> dict:
    db_status = "healthy"
    sqs_depth = 0
    last_sensor_reading_time: str | None = None

    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_status = "unhealthy"

    try:
        max_timestamp = db.scalar(select(func.max(SensorReading.recorded_at)))
        if max_timestamp is not None:
            last_sensor_reading_time = (
                max_timestamp.isoformat()
                if isinstance(max_timestamp, datetime)
                else str(max_timestamp)
            )
    except Exception:
        pass

    try:
        response = sqs_client.get_queue_attributes(
            QueueUrl=settings.sqs_sensor_queue_url,
            AttributeNames=["ApproximateNumberOfMessages"],
        )
        sqs_depth = int(response.get("Attributes", {}).get("ApproximateNumberOfMessages", 0))
    except (BotoCoreError, ClientError):
        sqs_depth = -1

    return {
        "database": db_status,
        "sqs_queue_depth": sqs_depth,
        "last_sensor_reading_time": last_sensor_reading_time,
    }
