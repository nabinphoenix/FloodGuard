"""Protected operational APIs for Field Officer sensor monitoring.

Official Authority alerts and automated sensor status are deliberately kept
separate. Sensor telemetry is stored in the project's RDS sensor_readings
table, queued through the existing SQS integration, and can publish transition
notifications through the existing SNS topic.
"""

from __future__ import annotations

import logging
from hmac import compare_digest

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models.sensor import SensorReading, SensorStation
from models.user import UserRole
from routers.auth import require_any_role
from services.dynamodb_service import sensor_store_health
from services.geography_service import load_geography
from services.sensor_ingestion import (
    InvalidSensorTimestampError,
    SensorStationInactiveError,
    SensorStationNotFoundError,
    classify_water_level,
    effective_watch_threshold,
    process_sensor_reading,
    station_status as _station_status,
)
from services.sns_service import publish_sensor_transition
from services.sqs_service import send_sensor_reading, sqs_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sensors", tags=["sensors"])


class SensorReadingIn(BaseModel):
    station_id: str | None = Field(default=None, min_length=1, max_length=20)
    station_code: str | None = Field(default=None, min_length=1, max_length=20)
    water_level: float = Field(..., ge=0)
    timestamp: str | None = None

    @model_validator(mode="after")
    def require_station_reference(self) -> "SensorReadingIn":
        station_id = self.station_id.strip() if self.station_id else None
        station_code = self.station_code.strip() if self.station_code else None
        if not station_id and not station_code:
            raise ValueError("station_id or station_code is required.")
        if station_id and station_code and station_id != station_code:
            raise ValueError("station_id and station_code must identify the same station.")
        self.station_id = station_id or station_code
        self.station_code = station_code or station_id
        return self


class DeviceSensorReadingIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    station_code: str = Field(..., min_length=1, max_length=20)
    water_level: float = Field(..., ge=0)
    timestamp: str | None = None

    @field_validator("station_code", mode="before")
    @classmethod
    def trim_station_code(cls, value: object) -> object:
        return value if value is None else str(value).strip()

class ThresholdUpdate(BaseModel):
    watch_threshold: float | None = Field(default=None, ge=0)
    warning_threshold: float = Field(..., ge=0)
    danger_threshold: float = Field(..., ge=0)


class StationPayload(BaseModel):
    station_code: str = Field(..., min_length=1, max_length=20)
    name: str = Field(..., min_length=1, max_length=150)
    province: str = Field(..., min_length=1, max_length=100)
    district: str = Field(..., min_length=1, max_length=100)
    river_basin: str = Field(..., min_length=1, max_length=150)
    river_name: str = Field(..., min_length=1, max_length=150)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    watch_threshold: float = Field(..., ge=0)
    warning_threshold: float = Field(..., ge=0)
    danger_threshold: float = Field(..., ge=0)

    @field_validator(
        "station_code", "name", "province", "district", "river_basin",
        "river_name", mode="before",
    )
    @classmethod
    def trim_text(cls, value: object) -> object:
        return value if value is None else str(value).strip()

    @model_validator(mode="after")
    def validate_threshold_order(self) -> "StationPayload":
        if self.watch_threshold >= self.warning_threshold:
            raise ValueError("Watch threshold must be less than warning threshold.")
        if self.warning_threshold >= self.danger_threshold:
            raise ValueError("Warning threshold must be less than emergency threshold.")
        return self


class StationUpdate(StationPayload):
    station_code: str | None = Field(default=None, min_length=1, max_length=20)


class StationStatusUpdate(BaseModel):
    is_active: bool



def alert_level_for_reading(water_level: float, station: SensorStation):
    """Compatibility helper for the existing official AlertLevel tests."""
    from models.alert import AlertLevel

    return AlertLevel(classify_water_level(
        water_level,
        effective_watch_threshold(station),
        station.warning_threshold,
        station.danger_threshold,
    ))



def _validate_geography(payload: StationPayload) -> None:
    data = load_geography()
    province = next(
        (item for item in data["provinces"]
         if item["name"].casefold() == payload.province.casefold()),
        None,
    )
    if province is None:
        raise HTTPException(status_code=422, detail="Province is not available in the geography reference data.")

    district = next(
        (item for item in province["districts"]
         if item["name"].casefold() == payload.district.casefold()),
        None,
    )
    if district is None:
        raise HTTPException(status_code=422, detail="District is not available for the selected province.")

    if not any(
        name.casefold() == payload.river_name.casefold()
        for name in district.get("rivers", [])
    ):
        raise HTTPException(status_code=422, detail="River is not available for the selected district.")

    basin_options = district.get("river_basins", [])
    if basin_options and not any(
        name.casefold() == payload.river_basin.casefold()
        for name in basin_options
    ):
        raise HTTPException(status_code=422, detail="River basin is not available for the selected district.")


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
    result: dict[str, dict] = {}
    for row in rows:
        station = db.get(SensorStation, row.station_id)
        if station is not None:
            result[row.station_id] = reading_to_dict(row, station)
    return result


def reading_to_dict(reading: SensorReading, station: SensorStation | None = None) -> dict:
    status_value = reading.status
    if status_value is None and station is not None:
        status_value = _station_status(station, reading.water_level)
    return {
        "id": reading.id,
        "station_id": reading.station_id,
        "station_code": reading.station_id,
        "water_level": reading.water_level,
        "status": status_value or "no_data",
        "timestamp": reading.recorded_at.isoformat(),
        "district": station.district if station else None,
    }


def station_to_dict(station: SensorStation, latest: dict | None = None) -> dict:
    water_level = latest.get("water_level") if latest else None
    status_level = (
        latest.get("status")
        if latest
        else _station_status(station, water_level)
    )
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
        "active": station.is_active,
        "created_at": station.created_at,
        "latest_reading": latest,
        "status": status_level,
    }


def _apply_payload(station: SensorStation, payload: StationPayload) -> None:
    station.name = payload.name
    station.province = payload.province
    station.district = payload.district
    station.river_basin = payload.river_basin
    station.river_name = payload.river_name
    station.latitude = payload.latitude
    station.longitude = payload.longitude
    station.watch_threshold = payload.watch_threshold
    station.warning_threshold = payload.warning_threshold
    station.danger_threshold = payload.danger_threshold


def _station_or_404(station_id: str, db: Session) -> SensorStation:
    station = db.get(SensorStation, station_id)
    if station is None:
        raise HTTPException(status_code=404, detail="Sensor station not found.")
    return station


def _validate_sensor_token(token: str | None) -> None:
    expected = settings.sensor_ingestion_token
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Device sensor ingestion is not configured.",
        )
    if not token or not compare_digest(token, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid sensor ingestion token.",
            headers={"WWW-Authenticate": "SensorToken"},
        )


def _ingestion_response(result) -> dict:
    saved = reading_to_dict(result.reading, result.station)
    return {
        "message": "Sensor reading saved.",
        "reading": saved,
        "station": station_to_dict(result.station, saved),
        "status": result.current_status,
        "alert_level": result.current_status,
        "previous_status": result.previous_status,
        "notification": result.notification,
        "queue": result.queue,
        "source": result.source,
    }


def _process_sensor_reading(
    db: Session,
    station_code: str,
    water_level: float,
    *,
    timestamp: str | None,
    source: str,
) -> dict:
    try:
        result = process_sensor_reading(
            db,
            station_code,
            water_level,
            timestamp=timestamp,
            source=source,
            notification_publisher=publish_sensor_transition,
            queue_sender=send_sensor_reading,
        )
    except SensorStationNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Sensor station not found.") from exc
    except SensorStationInactiveError as exc:
        raise HTTPException(status_code=400, detail="Sensor station is inactive.") from exc
    except InvalidSensorTimestampError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    return _ingestion_response(result)

def _dashboard_payload(db: Session) -> dict:
    stations = db.scalars(select(SensorStation).order_by(SensorStation.id.asc())).all()
    latest_by_station = _latest_per_station(db, [station.id for station in stations])
    station_payloads = [
        station_to_dict(station, latest_by_station.get(station.id))
        for station in stations
    ]
    active_stations = [item for item in station_payloads if item["is_active"]]
    counts = {key: 0 for key in ("safe", "watch", "warning", "emergency")}
    for item in active_stations:
        if item["status"] in counts:
            counts[item["status"]] += 1
    recent = sorted(
        (
            {
                "station_code": item["station_code"],
                "station_name": item["station_name"],
                "province": item["province"],
                "district": item["district"],
                "river_name": item["river_name"],
                "status": item["status"],
                **(item["latest_reading"] or {}),
            }
            for item in active_stations
            if item["latest_reading"]
        ),
        key=lambda item: item.get("timestamp", ""),
        reverse=True,
    )
    return {
        "summary": {
            "total_stations": len(stations),
            "active_stations": len(active_stations),
            "stations_no_data": sum(item["status"] == "no_data" for item in active_stations),
            "safe_stations": counts["safe"],
            "watch_stations": counts["watch"],
            "warning_stations": counts["warning"],
            "emergency_stations": counts["emergency"],
            "latest_reading_time": recent[0]["timestamp"] if recent else None,
        },
        "stations": station_payloads,
        "recent_readings": recent[:12],
    }


@router.get("/dashboard", dependencies=[Depends(require_any_role(UserRole.field_officer, UserRole.admin))])
def get_sensor_dashboard(db: Session = Depends(get_db)) -> dict:
    return _dashboard_payload(db)


@router.post(
    "/stations",
    dependencies=[Depends(require_any_role(UserRole.field_officer, UserRole.admin))],
)
def create_station(payload: StationPayload, db: Session = Depends(get_db)) -> dict:
    _validate_geography(payload)
    if db.get(SensorStation, payload.station_code) is not None:
        raise HTTPException(status_code=409, detail="A sensor station with this station code already exists.")
    station = SensorStation(id=payload.station_code, is_active=True)
    _apply_payload(station, payload)
    db.add(station)
    try:
        db.commit()
        db.refresh(station)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="A sensor station with this station code already exists.") from exc
    return station_to_dict(station)


@router.get(
    "/stations",
    dependencies=[Depends(require_any_role(UserRole.field_officer, UserRole.admin))],
)
def get_stations(db: Session = Depends(get_db)) -> list[dict]:
    stations = db.scalars(select(SensorStation).order_by(SensorStation.id.asc())).all()
    latest_by_station = _latest_per_station(db, [station.id for station in stations])
    return [station_to_dict(station, latest_by_station.get(station.id)) for station in stations]


@router.get(
    "/stations/{station_id}",
    dependencies=[Depends(require_any_role(UserRole.field_officer, UserRole.admin))],
)
def get_station(station_id: str, db: Session = Depends(get_db)) -> dict:
    station = _station_or_404(station_id, db)
    return station_to_dict(station, _latest_per_station(db, [station.id]).get(station.id))


@router.put(
    "/stations/{station_id}",
    dependencies=[Depends(require_any_role(UserRole.field_officer, UserRole.admin))],
)
def update_station(station_id: str, payload: StationUpdate, db: Session = Depends(get_db)) -> dict:
    station = _station_or_404(station_id, db)
    _validate_geography(payload)
    if payload.station_code and payload.station_code != station.id:
        raise HTTPException(status_code=400, detail="Station code cannot be changed after creation.")
    _apply_payload(station, payload)
    db.add(station)
    try:
        db.commit()
        db.refresh(station)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not update sensor station.") from exc
    return station_to_dict(station, _latest_per_station(db, [station.id]).get(station.id))


@router.put(
    "/stations/{station_id}/status",
    dependencies=[Depends(require_any_role(UserRole.field_officer, UserRole.admin))],
)
def update_station_status(
    station_id: str,
    payload: StationStatusUpdate,
    db: Session = Depends(get_db),
) -> dict:
    station = _station_or_404(station_id, db)
    station.is_active = payload.is_active
    db.add(station)
    db.commit()
    db.refresh(station)
    return station_to_dict(station, _latest_per_station(db, [station.id]).get(station.id))


@router.delete(
    "/stations/{station_id}",
    dependencies=[Depends(require_any_role(UserRole.field_officer, UserRole.admin))],
)
def delete_station(station_id: str, db: Session = Depends(get_db)) -> dict:
    station = _station_or_404(station_id, db)
    reading_count = db.scalar(
        select(func.count(SensorReading.id)).where(SensorReading.station_id == station.id)
    ) or 0
    if reading_count:
        raise HTTPException(
            status_code=409,
            detail="This station has historical sensor readings and cannot be deleted. Deactivate it instead.",
        )
    db.delete(station)
    db.commit()
    return {"message": "Sensor station deleted.", "station_code": station_id}


@router.put(
    "/stations/{station_id}/thresholds",
    dependencies=[Depends(require_any_role(UserRole.field_officer, UserRole.admin))],
)
def update_thresholds(
    station_id: str,
    payload: ThresholdUpdate,
    db: Session = Depends(get_db),
) -> dict:
    station = _station_or_404(station_id, db)
    watch_threshold = (
        payload.watch_threshold
        if payload.watch_threshold is not None
        else effective_watch_threshold(station)
    )
    if watch_threshold is None or watch_threshold >= payload.warning_threshold:
        raise HTTPException(status_code=400, detail="Watch threshold must be less than warning threshold.")
    if payload.warning_threshold >= payload.danger_threshold:
        raise HTTPException(status_code=400, detail="Warning threshold must be less than emergency threshold.")
    station.watch_threshold = watch_threshold
    station.warning_threshold = payload.warning_threshold
    station.danger_threshold = payload.danger_threshold
    db.add(station)
    db.commit()
    db.refresh(station)
    return station_to_dict(station, _latest_per_station(db, [station_id]).get(station_id))


@router.post(
    "/reading",
    dependencies=[Depends(require_any_role(UserRole.field_officer, UserRole.admin))],
)
def receive_sensor_reading(reading: SensorReadingIn, db: Session = Depends(get_db)) -> dict:
    return _process_sensor_reading(
        db,
        reading.station_id or reading.station_code or "",
        reading.water_level,
        timestamp=reading.timestamp,
        source="manual",
    )


@router.get("/device-stations/{station_id}")
def get_device_station(
    station_id: str,
    x_sensor_token: str | None = Header(default=None, alias="X-Sensor-Token"),
    db: Session = Depends(get_db),
) -> dict:
    _validate_sensor_token(x_sensor_token)
    station = _station_or_404(station_id, db)
    if not station.is_active:
        raise HTTPException(status_code=400, detail="Sensor station is inactive.")
    return {
        "station_code": station.id,
        "station_name": station.name,
        "province": station.province,
        "district": station.district,
        "river_name": station.river_name,
        "watch_threshold": effective_watch_threshold(station),
        "warning_threshold": station.warning_threshold,
        "danger_threshold": station.danger_threshold,
        "is_active": station.is_active,
    }


@router.post("/device-reading", status_code=status.HTTP_201_CREATED)
def receive_device_sensor_reading(
    reading: DeviceSensorReadingIn,
    x_sensor_token: str | None = Header(default=None, alias="X-Sensor-Token"),
    db: Session = Depends(get_db),
) -> dict:
    _validate_sensor_token(x_sensor_token)
    return _process_sensor_reading(
        db,
        reading.station_code,
        reading.water_level,
        timestamp=reading.timestamp,
        source="simulator-aws",
    )

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
    station = _station_or_404(station_id, db)
    rows = db.scalars(
        select(SensorReading)
        .where(SensorReading.station_id == station_id)
        .order_by(SensorReading.recorded_at.desc(), SensorReading.id.desc())
        .limit(limit)
    ).all()
    return {
        "station": station_to_dict(station),
        "readings": [reading_to_dict(row, station) for row in reversed(rows)],
    }


@router.get(
    "/health",
    dependencies=[Depends(require_any_role(UserRole.field_officer, UserRole.admin))],
)
def get_sensor_health(db: Session = Depends(get_db)) -> dict:
    db_status = "healthy"
    latest_reading: SensorReading | None = None
    last_sensor_reading_time: str | None = None
    try:
        db.execute(text("SELECT 1"))
        latest_reading = db.scalars(
            select(SensorReading)
            .order_by(SensorReading.recorded_at.desc(), SensorReading.id.desc())
            .limit(1)
        ).first()
        if latest_reading is not None:
            last_sensor_reading_time = latest_reading.recorded_at.isoformat()
    except Exception as exc:
        logger.error("RDS sensor health check failed: %s", exc)
        db_status = "unhealthy"

    sqs_depth = 0
    try:
        response = sqs_client.get_queue_attributes(
            QueueUrl=settings.sqs_sensor_queue_url,
            AttributeNames=["ApproximateNumberOfMessages"],
        )
        sqs_depth = int(response.get("Attributes", {}).get("ApproximateNumberOfMessages", 0))
    except (BotoCoreError, ClientError, ValueError):
        sqs_depth = -1

    try:
        dynamodb = sensor_store_health()
    except Exception as exc:
        logger.error("DynamoDB health check failed: %s", exc)
        dynamodb = {"status": "unavailable", "detail": "DynamoDB health check failed."}

    return {
        "database": db_status,
        "rds": db_status,
        "dynamodb": dynamodb["status"],
        "dynamodb_detail": dynamodb["detail"],
        "sqs": "healthy" if sqs_depth >= 0 else "unavailable",
        "sqs_queue_depth": sqs_depth,
        "last_sensor_reading_time": last_sensor_reading_time,
        "latest_sensor_reading": reading_to_dict(latest_reading) if latest_reading else None,
    }
