from datetime import datetime, timezone

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from database import get_db
from models.alert import AlertLevel, AlertZone
from models.sensor import SensorStation
from models.user import UserRole
from routers.auth import require_role
from services import dynamo_service
from services.sqs_service import sqs_client
from config import settings


router = APIRouter(prefix="/sensors", tags=["sensors"])


class SensorReadingIn(BaseModel):
    station_id: str = Field(..., min_length=1, max_length=20)
    water_level: float = Field(..., ge=0)
    timestamp: str | None = None


class ThresholdUpdate(BaseModel):
    warning_threshold: float = Field(..., ge=0)
    danger_threshold: float = Field(..., ge=0)


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


@router.post("/reading", dependencies=[Depends(require_role(UserRole.authority))])
def receive_sensor_reading(reading: SensorReadingIn, db: Session = Depends(get_db)) -> dict:
    station = db.get(SensorStation, reading.station_id)
    if station is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor station not found.")
    if not station.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sensor station is inactive.")

    timestamp = reading.timestamp or datetime.now(timezone.utc).isoformat()
    saved = dynamo_service.save_reading(
        station_id=station.id,
        timestamp=timestamp,
        water_level=reading.water_level,
        district=station.district,
    )

    zone_level = alert_level_for_reading(reading.water_level, station)
    sync_zone_level(db, station, zone_level)

    return {
        "message": "Sensor reading saved.",
        "reading": saved,
        "station": station_to_dict(station, saved),
        "alert_level": zone_level.value,
    }


@router.get("/live")
def get_live_readings(db: Session = Depends(get_db)) -> list[dict]:
    latest_by_station = {
        reading["station_id"]: reading for reading in dynamo_service.get_all_latest()
    }
    stations = db.scalars(
        select(SensorStation).where(SensorStation.is_active == True).order_by(SensorStation.id.asc())
    ).all()
    return [station_to_dict(station, latest_by_station.get(station.id)) for station in stations]


@router.get("/history/{station_id}", dependencies=[Depends(require_role(UserRole.authority))])
def get_history(
    station_id: str,
    limit: int = Query(default=48, ge=1, le=200),
    db: Session = Depends(get_db),
) -> dict:
    station = db.get(SensorStation, station_id)
    if station is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor station not found.")

    return {
        "station": station_to_dict(station),
        "readings": dynamo_service.get_station_history(station_id, limit=limit),
    }


@router.get("/stations", dependencies=[Depends(require_role(UserRole.authority))])
def get_stations(db: Session = Depends(get_db)) -> list[dict]:
    stations = db.scalars(select(SensorStation).order_by(SensorStation.id.asc())).all()
    return [station_to_dict(station, dynamo_service.get_latest_reading(station.id)) for station in stations]


@router.put("/stations/{station_id}/thresholds", dependencies=[Depends(require_role(UserRole.authority))])
def update_thresholds(
    station_id: str,
    payload: ThresholdUpdate,
    db: Session = Depends(get_db),
) -> dict:
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
    return station_to_dict(station, dynamo_service.get_latest_reading(station.id))


@router.get("/health", dependencies=[Depends(require_role(UserRole.authority))])
def get_sensor_health(db: Session = Depends(get_db)) -> dict:
    db_status = "healthy"
    dynamodb_status = "healthy"
    sqs_depth = 0
    last_sensor_reading_time = None

    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_status = "unhealthy"

    try:
        latest = dynamo_service.get_all_latest()
        if latest:
            last_sensor_reading_time = max(reading["timestamp"] for reading in latest)
    except Exception:
        dynamodb_status = "unhealthy"

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
        "dynamodb": dynamodb_status,
        "sqs_queue_depth": sqs_depth,
        "last_sensor_reading_time": last_sensor_reading_time,
    }
