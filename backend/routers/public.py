from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models.alert import AlertLevel, AlertZone, FloodAlert
from models.report import IncidentReport


router = APIRouter(prefix="/public", tags=["public"])

ALERT_SEVERITY_ORDER = {
    AlertLevel.emergency: 4,
    AlertLevel.warning: 3,
    AlertLevel.watch: 2,
    AlertLevel.safe: 1,
}


def alert_zone_to_dict(zone: AlertZone) -> dict:
    return {
        "id": zone.id,
        "district": zone.district,
        "alert_level": zone.alert_level.value,
        "latitude": zone.latitude,
        "longitude": zone.longitude,
        "updated_at": zone.updated_at,
    }


@router.get("/alerts")
def get_alerts(db: Session = Depends(get_db)) -> list[dict]:
    severity_order = case(
        (AlertZone.alert_level == AlertLevel.emergency, 4),
        (AlertZone.alert_level == AlertLevel.warning, 3),
        (AlertZone.alert_level == AlertLevel.watch, 2),
        else_=1,
    )
    zones = db.scalars(
        select(AlertZone).order_by(severity_order.desc(), AlertZone.district.asc())
    ).all()
    return [alert_zone_to_dict(zone) for zone in zones]


@router.get("/alerts/history")
def get_alert_history(db: Session = Depends(get_db)) -> list[dict]:
    alerts = db.scalars(
        select(FloodAlert)
        .options(joinedload(FloodAlert.zone))
        .order_by(FloodAlert.triggered_at.desc())
        .limit(20)
    ).all()

    return [
        {
            "id": alert.id,
            "zone_id": alert.zone_id,
            "district": alert.zone.district if alert.zone else None,
            "zone": alert_zone_to_dict(alert.zone) if alert.zone else None,
            "triggered_by": alert.triggered_by,
            "alert_level": alert.alert_level.value,
            "message": alert.message,
            "sns_message_id": alert.sns_message_id,
            "triggered_at": alert.triggered_at,
        }
        for alert in alerts
    ]


@router.get("/alerts/{district}")
def get_alert_by_district(district: str, db: Session = Depends(get_db)) -> dict:
    zone = db.scalar(
        select(AlertZone).where(func.lower(AlertZone.district) == district.strip().lower())
    )
    if zone is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No alert zone found for district '{district}'.",
        )

    return alert_zone_to_dict(zone)


@router.get("/zones")
def get_zones(db: Session = Depends(get_db)) -> list[dict]:
    zones = db.scalars(select(AlertZone).order_by(AlertZone.district.asc())).all()
    return [
        {
            "id": zone.id,
            "district": zone.district,
            "alert_level": zone.alert_level.value,
            "latitude": zone.latitude,
            "longitude": zone.longitude,
        }
        for zone in zones
    ]


@router.get("/stats")
def get_public_stats(db: Session = Depends(get_db)) -> dict[str, int]:
    total_reports = db.scalar(select(func.count(IncidentReport.id))) or 0
    active_alerts = (
        db.scalar(
            select(func.count(AlertZone.id)).where(AlertZone.alert_level != AlertLevel.safe)
        )
        or 0
    )
    total_zones = db.scalar(select(func.count(AlertZone.id))) or 0

    return {
        "total_reports": total_reports,
        "active_alerts": active_alerts,
        "total_zones": total_zones,
    }
