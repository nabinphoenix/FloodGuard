"""Sensor router — all readings stored in relational DB (sensor_readings table).

DynamoDB has been removed.  Every persistence operation now goes through
SQLAlchemy / MySQL-compatible RDS.

Endpoints
---------
POST  /sensors/reading                   — ingest a new water-level reading
GET   /sensors/live                      — latest reading per active station
GET   /sensors/history/{station_id}      — ordered history for one station
GET   /sensors/stations                  — all stations with their latest reading
PUT   /sensors/stations/{station_id}/thresholds — update warning/danger thresholds
GET   /sensors/health                    — relational DB + SQS health check
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
from routers.auth import require_any_role, require_role
from services.sqs_service import send_sensor_reading, sqs_client

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/sensors", tags=["sensors"])


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class SensorReadingIn(BaseModel):
    station_id: str = Field(..., min_length=1, max_length=20)
    water_level: float = Field(..., ge=0)
    # Optional ISO-8601 timestamp from the sensor.  Defaults to UTC now.
    timestamp: str | None = None


class ThresholdUpdate(BaseModel):
    warning_threshold: float = Field(..., ge=0)
    danger_threshold: float = Field(..., ge=0)


# ---------------------------------------------------------------------------
# Serialisation helpers
# ---------------------------------------------------------------------------

def reading_to_dict(reading: SensorReading, district: str | None = None) -> dict:
    """Convert a SensorReading ORM row to the dict shape the frontend expects.

    The ``timestamp`` key is deliberately kept so existing frontend code
    (SensorDash, WaterLevelChart) continues to work without modification.
    """
    return {
        "station_id": reading.station_id,
        "water_level": reading.water_level,
        # Frontend accesses reading.timestamp — preserve the key name.
        "timestamp": reading.recorded_at.isoformat(),
        "district": district,
    }


def station_to_dict(station: SensorStation, latest: dict | None = None) -> dict:
    status_level = "safe"
    water_level = latest.get("water_level") if latest else None

    if water_level is not None:
        if water_level >= station.danger_threshold:
            status_level = "danger"
        elif water_level >= station.warning_threshold:
            status_level = "warning"

    return {
        "id": station.id,
        "name": station.name,
        "district": station.district,
        "latitude": station.latitude,
        "longitude": station.longitude,
        "warning_threshold": station.warning_threshold,
        "danger_threshold": station.danger_threshold,
        "is_active": station.is_active,
        "created_at": station.created_at,
        "latest_reading": latest,
        "status": status_level,
    }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _parse_timestamp(raw: str | None) -> datetime:
    """Parse an optional ISO-8601 string; fall back to UTC now."""
    if not raw:
        return datetime.now(timezone.utc)
    try:
        dt = datetime.fromisoformat(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return datetime.now(timezone.utc)


def _latest_per_station(db: Session, station_ids: list[str]) -> dict[str, dict]:
    """Return a mapping of station_id → reading dict for the most recent
    reading of each requested station.

    Uses a single SQL query with a correlated subquery so we avoid N+1 calls
    and a full table scan.
    """
    if not station_ids:
        return {}

    # Subquery: for each station, find the max recorded_at.
    subq = (
        select(
            SensorReading.station_id,
            func.max(SensorReading.recorded_at).label("max_recorded_at"),
        )
        .where(SensorReading.station_id.in_(station_ids))
        .group_by(SensorReading.station_id)
        .subquery()
    )

    # Join back to get the full reading row.
    stmt = select(SensorReading).join(
        subq,
        (SensorReading.station_id == subq.c.station_id)
        & (SensorReading.recorded_at == subq.c.max_recorded_at),
    )

    rows = db.scalars(stmt).all()
    result: dict[str, dict] = {}
    for row in rows:
        # district is resolved from the station later; pass None here.
        result[row.station_id] = reading_to_dict(row)
    return result


def alert_level_for_reading(water_level: float, station: SensorStation) -> AlertLevel:
    if water_level >= station.danger_threshold:
        return AlertLevel.emergency
    if water_level >= station.warning_threshold:
        return AlertLevel.warning
    return AlertLevel.safe


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


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/reading", dependencies=[Depends(require_role(UserRole.field_officer))])
def receive_sensor_reading(reading: SensorReadingIn, db: Session = Depends(get_db)) -> dict:
    """Ingest a water-level measurement and persist it to sensor_readings."""
    station = db.get(SensorStation, reading.station_id)
    if station is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor station not found.")
    if not station.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sensor station is inactive.")

    recorded_at = _parse_timestamp(reading.timestamp)

    previous_reading = db.scalars(
        select(SensorReading)
        .where(SensorReading.station_id == station.id)
        .order_by(SensorReading.recorded_at.desc())
        .limit(1)
    ).first()

    previous_alert_level = "safe"
    if previous_reading:
        previous_alert_level = alert_level_for_reading(previous_reading.water_level, station).value

    db_reading = SensorReading(
        station_id=station.id,
        water_level=reading.water_level,
        recorded_at=recorded_at,
    )
    db.add(db_reading)
    db.commit()
    db.refresh(db_reading)

    saved = reading_to_dict(db_reading, district=station.district)

    zone_level = alert_level_for_reading(reading.water_level, station)
    sync_zone_level(db, station, zone_level)

    # Dispatch to SQS
    try:
        sqs_payload = {
            "station_id": station.id,
            "name": station.name,
            "district": station.district,
            "water_level": db_reading.water_level,
            "warning_threshold": station.warning_threshold,
            "danger_threshold": station.danger_threshold,
            "timestamp": db_reading.recorded_at.isoformat(),
            "previous_alert_level": previous_alert_level,
            "current_alert_level": zone_level.value,
        }
        send_sensor_reading(sqs_payload)
    except Exception as e:
        logger.error(f"Failed to dispatch sensor reading to SQS for station {station.id}: {e}")

    return {
        "message": "Sensor reading saved.",
        "reading": saved,
        "station": station_to_dict(station, saved),
        "alert_level": zone_level.value,
    }


@router.get("/live")
def get_live_readings(db: Session = Depends(get_db)) -> list[dict]:
    """Return the latest reading for every active sensor station."""
    stations = db.scalars(
        select(SensorStation)
        .where(SensorStation.is_active == True)  # noqa: E712
        .order_by(SensorStation.id.asc())
    ).all()

    station_ids = [s.id for s in stations]
    latest_by_station = _latest_per_station(db, station_ids)

    return [station_to_dict(s, latest_by_station.get(s.id)) for s in stations]


@router.get("/history/{station_id}", dependencies=[Depends(require_any_role(UserRole.field_officer, UserRole.admin))])
def get_history(
    station_id: str,
    limit: int = Query(default=48, ge=1, le=200),
    db: Session = Depends(get_db),
) -> dict:
    """Return the most-recent ``limit`` readings for a station, oldest-first."""
    station = db.get(SensorStation, station_id)
    if station is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor station not found.")

    # Fetch newest-first, then reverse to get chronological order for charts.
    rows = db.scalars(
        select(SensorReading)
        .where(SensorReading.station_id == station_id)
        .order_by(SensorReading.recorded_at.desc())
        .limit(limit)
    ).all()

    readings = [reading_to_dict(r, district=station.district) for r in reversed(rows)]

    return {
        "station": station_to_dict(station),
        "readings": readings,
    }


@router.get("/stations", dependencies=[Depends(require_any_role(UserRole.field_officer, UserRole.admin))])
def get_stations(db: Session = Depends(get_db)) -> list[dict]:
    """Return all stations (active and inactive) with their latest readings."""
    stations = db.scalars(select(SensorStation).order_by(SensorStation.id.asc())).all()

    station_ids = [s.id for s in stations]
    latest_by_station = _latest_per_station(db, station_ids)

    return [station_to_dict(s, latest_by_station.get(s.id)) for s in stations]


@router.put("/stations/{station_id}/thresholds", dependencies=[Depends(require_role(UserRole.admin))])
def update_thresholds(
    station_id: str,
    payload: ThresholdUpdate,
    db: Session = Depends(get_db),
) -> dict:
    """Update the warning/danger water-level thresholds for a station."""
    if payload.danger_threshold < payload.warning_threshold:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Danger threshold must be greater than or equal to warning threshold.",
        )

    station = db.get(SensorStation, station_id)
    if station is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor station not found.")

    station.warning_threshold = payload.warning_threshold
    station.danger_threshold = payload.danger_threshold
    db.add(station)
    db.commit()
    db.refresh(station)

    latest_by_station = _latest_per_station(db, [station_id])
    return station_to_dict(station, latest_by_station.get(station_id))


@router.get("/health", dependencies=[Depends(require_role(UserRole.field_officer))])
def get_sensor_health(db: Session = Depends(get_db)) -> dict:
    """Report health of the relational database and the SQS sensor queue.

    DynamoDB status has been removed — readings are now stored in RDS.
    """
    db_status = "healthy"
    sqs_depth = 0
    last_sensor_reading_time: str | None = None

    # Relational DB check.
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_status = "unhealthy"

    # Most-recent sensor reading timestamp from RDS.
    try:
        max_ts = db.scalar(select(func.max(SensorReading.recorded_at)))
        if max_ts is not None:
            last_sensor_reading_time = (
                max_ts.isoformat() if isinstance(max_ts, datetime) else str(max_ts)
            )
    except Exception:
        pass  # Non-fatal; leave last_sensor_reading_time as None.

    # SQS queue depth.
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
