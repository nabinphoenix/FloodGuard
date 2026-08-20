from datetime import datetime

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models.alert import AlertLevel, AlertZone, FloodAlert
from models.report import IncidentReport, ReportStatus
from models.user import User, UserRole
from routers.auth import require_role
from schemas.alert import AlertZoneOut


router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_role(UserRole.admin))],
)


class AlertZoneCreate(BaseModel):
    district: str = Field(..., min_length=2, max_length=100)
    alert_level: AlertLevel = AlertLevel.safe
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class UserRoleUpdate(BaseModel):
    role: UserRole


def flood_alert_to_out(alert: FloodAlert) -> dict:
    return {
        "id": alert.id,
        "zone_id": alert.zone_id,
        "district": alert.zone.district if alert.zone else "",
        "alert_level": alert.alert_level.value if alert.alert_level else "",
        "message": alert.message,
        "sns_message_id": alert.sns_message_id,
        "triggered_at": alert.triggered_at,
    }


@router.get("/dashboard")
def get_dashboard(db: Session = Depends(get_db)) -> dict:
    total_reports = db.scalar(select(func.count(IncidentReport.id))) or 0
    total_users = db.scalar(select(func.count(User.id))) or 0
    total_zones = db.scalar(select(func.count(AlertZone.id))) or 0

    return {
        "total_reports": total_reports,
        "total_users": total_users,
        "total_zones": total_zones,
    }


@router.get("/zones", response_model=list[AlertZoneOut])
def get_zones(db: Session = Depends(get_db)) -> list[AlertZone]:
    return list(db.scalars(select(AlertZone).order_by(AlertZone.district.asc())).all())


@router.post("/zones", response_model=AlertZoneOut, status_code=status.HTTP_201_CREATED)
def create_zone(zone_in: AlertZoneCreate, db: Session = Depends(get_db)) -> AlertZone:
    existing_zone = db.scalar(
        select(AlertZone).where(func.lower(AlertZone.district) == zone_in.district.strip().lower())
    )
    if existing_zone:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An alert zone already exists for this district.",
        )

    zone = AlertZone(
        district=zone_in.district.strip(),
        alert_level=zone_in.alert_level,
        latitude=zone_in.latitude,
        longitude=zone_in.longitude,
    )
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone


@router.get("/users")
def get_users(db: Session = Depends(get_db)) -> list[dict]:
    users = db.scalars(select(User).order_by(User.created_at.desc())).all()
    return [
        {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "phone": user.phone,
            "district": user.district,
            "role": user.role.value,
            "email_alerts": user.email_alerts,
            "sms_alerts": user.sms_alerts,
            "created_at": user.created_at,
        }
        for user in users
    ]


@router.put("/users/{user_id}/role", dependencies=[Depends(require_role(UserRole.admin))])
def update_user_role(
    user_id: int,
    payload: UserRoleUpdate,
    db: Session = Depends(get_db),
) -> dict:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    user.role = payload.role
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role.value,
    }
