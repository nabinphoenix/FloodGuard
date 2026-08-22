from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from models.alert import AlertLevel, AlertZone, FloodAlert
from models.report import IncidentReport, ReportStatus
from models.sensor import SensorReading, SensorStation
from schemas.map import PublicMapResponse
from services.coordinate_validation import is_within_nepal_operational_bounds
from services.geography_service import province_for_district
from services.sensor_ingestion import station_status


router = APIRouter(tags=["public"])


@router.get("/map", response_model=PublicMapResponse)
def get_public_map(db: Session = Depends(get_db)) -> PublicMapResponse:
    """Return public-safe data for the shared FloodGuard map."""
    stale_after = timedelta(minutes=5)
    now = datetime.now(timezone.utc)

    sensors = []
    stations = db.scalars(
        select(SensorStation)
        .where(SensorStation.is_active.is_(True))
        .order_by(SensorStation.district.asc(), SensorStation.name.asc())
    ).all()
    for station in stations:
        if not is_within_nepal_operational_bounds(station.latitude, station.longitude):
            continue
        latest = db.scalars(
            select(SensorReading)
            .where(SensorReading.station_id == station.id)
            .order_by(SensorReading.recorded_at.desc(), SensorReading.id.desc())
            .limit(1)
        ).first()
        recorded_at = latest.recorded_at if latest else None
        comparison_time = recorded_at
        if comparison_time and comparison_time.tzinfo is None:
            comparison_time = comparison_time.replace(tzinfo=timezone.utc)
        sensors.append(
            {
                "station_code": station.id,
                "name": station.name,
                "province": station.province,
                "district": station.district,
                "river_basin": station.river_basin,
                "river_name": station.river_name,
                "latitude": station.latitude,
                "longitude": station.longitude,
                "latest_water_level": latest.water_level if latest else None,
                "status": latest.status if latest and latest.status else station_status(station, latest.water_level if latest else None),
                "last_reading_at": recorded_at,
                "is_stale": bool(comparison_time and now - comparison_time > stale_after),
                "watch_threshold": station.watch_threshold,
                "warning_threshold": station.warning_threshold,
                "emergency_threshold": station.danger_threshold,
            }
        )

    zones = []
    for zone in db.scalars(select(AlertZone).order_by(AlertZone.district.asc())).all():
        if not is_within_nepal_operational_bounds(zone.latitude, zone.longitude):
            continue
        zones.append(
            {
                "id": zone.id,
                "name": zone.district,
                "province": province_for_district(zone.district),
                "district": zone.district,
                "alert_level": zone.alert_level.value,
                "latitude": zone.latitude,
                "longitude": zone.longitude,
                "updated_at": zone.updated_at,
            }
        )

    alerts = []
    alert_rows = db.execute(
        select(FloodAlert, AlertZone)
        .join(AlertZone, AlertZone.id == FloodAlert.zone_id)
        .where(
            AlertZone.alert_level != AlertLevel.safe,
            FloodAlert.alert_level != AlertLevel.safe,
        )
        .order_by(FloodAlert.triggered_at.desc())
        .limit(100)
    ).all()
    seen_zone_ids = set()
    for alert, zone in alert_rows:
        if zone.id in seen_zone_ids:
            continue
        seen_zone_ids.add(zone.id)
        if not is_within_nepal_operational_bounds(zone.latitude, zone.longitude):
            continue
        alerts.append(
            {
                "id": alert.id,
                "zone_id": zone.id,
                "district": zone.district,
                "province": province_for_district(zone.district),
                "zone_name": zone.district,
                "alert_level": zone.alert_level.value,
                "message": alert.message,
                "triggered_at": alert.triggered_at,
                "latitude": zone.latitude,
                "longitude": zone.longitude,
            }
        )

    reports = []
    for report in db.scalars(
        select(IncidentReport)
        .where(
            IncidentReport.status == ReportStatus.approved,
            IncidentReport.latitude.is_not(None),
            IncidentReport.longitude.is_not(None),
        )
        .order_by(IncidentReport.created_at.desc())
        .limit(100)
    ).all():
        if not is_within_nepal_operational_bounds(report.latitude, report.longitude):
            continue
        reports.append(
            {
                "id": report.id,
                "province": report.province,
                "district": report.district,
                "zone_id": report.zone_id,
                "severity": report.severity,
                "description": report.description,
                "latitude": report.latitude,
                "longitude": report.longitude,
                "created_at": report.created_at,
            }
        )

    return PublicMapResponse(sensors=sensors, zones=zones, alerts=alerts, reports=reports)
