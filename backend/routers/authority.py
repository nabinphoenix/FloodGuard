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
from schemas.alert import BroadcastRequest, FloodAlertOut
from services.s3_service import get_presigned_url
from services.sns_service import broadcast_alert


router = APIRouter(
    prefix="/authority",
    tags=["authority"],
    dependencies=[Depends(require_role(UserRole.authority))],
)


class RejectReportRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=1000)


def report_to_authority_dict(report: IncidentReport) -> dict:
    return {
        "id": report.id,
        "user_id": report.user_id,
        "submitted_by": report.user.name if report.user else "Unknown user",
        "district": report.district,
        "severity": report.severity,
        "description": report.description,
        "image_url": get_presigned_url(report.image_key) if report.image_key else None,
        "latitude": report.latitude,
        "longitude": report.longitude,
        "status": report.status.value,
        "rejection_reason": report.rejection_reason,
        "helpful_count": report.helpful_count,
        "created_at": report.created_at,
    }


def flood_alert_to_out(alert: FloodAlert) -> FloodAlertOut:
    return FloodAlertOut(
        id=alert.id,
        zone_id=alert.zone_id,
        district=alert.zone.district if alert.zone else "",
        alert_level=alert.alert_level,
        message=alert.message,
        sns_message_id=alert.sns_message_id,
        triggered_at=alert.triggered_at,
    )


@router.get("/dashboard")
def get_dashboard(db: Session = Depends(get_db)) -> dict:
    pending_reports = (
        db.scalar(
            select(func.count(IncidentReport.id)).where(
                IncidentReport.status == ReportStatus.pending
            )
        )
        or 0
    )
    active_alerts = (
        db.scalar(
            select(func.count(AlertZone.id)).where(AlertZone.alert_level != AlertLevel.safe)
        )
        or 0
    )
    recent_alerts = db.scalars(
        select(FloodAlert)
        .options(joinedload(FloodAlert.zone))
        .order_by(FloodAlert.triggered_at.desc())
        .limit(5)
    ).all()

    return {
        "pending_reports": pending_reports,
        "active_alerts": active_alerts,
        "recent_alerts": [flood_alert_to_out(alert).model_dump() for alert in recent_alerts],
    }


@router.get("/reports")
def get_reports(
    status_filter: ReportStatus | None = Query(default=None, alias="status"),
    district: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> list[dict]:
    query = select(IncidentReport).options(joinedload(IncidentReport.user))

    if status_filter:
        query = query.where(IncidentReport.status == status_filter)
    if district:
        query = query.where(IncidentReport.district == district)

    reports = db.scalars(
        query.order_by(IncidentReport.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    ).all()
    return [report_to_authority_dict(report) for report in reports]


@router.put("/reports/{report_id}/approve")
def approve_report(report_id: int, db: Session = Depends(get_db)) -> dict:
    report = db.scalar(
        select(IncidentReport)
        .options(joinedload(IncidentReport.user))
        .where(IncidentReport.id == report_id)
    )
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    report.status = ReportStatus.approved
    report.rejection_reason = None
    db.add(report)
    db.commit()
    db.refresh(report)
    return report_to_authority_dict(report)


@router.put("/reports/{report_id}/reject")
def reject_report(
    report_id: int,
    payload: RejectReportRequest = Body(...),
    db: Session = Depends(get_db),
) -> dict:
    report = db.scalar(
        select(IncidentReport)
        .options(joinedload(IncidentReport.user))
        .where(IncidentReport.id == report_id)
    )
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    report.status = ReportStatus.rejected
    report.rejection_reason = payload.reason.strip()
    db.add(report)
    db.commit()
    db.refresh(report)
    return report_to_authority_dict(report)


@router.post("/broadcast-alert", response_model=FloodAlertOut, status_code=status.HTTP_201_CREATED)
def broadcast_zone_alert(
    payload: BroadcastRequest,
    current_authority: User = Depends(require_role(UserRole.authority)),
    db: Session = Depends(get_db),
) -> FloodAlertOut:
    zone = db.get(AlertZone, payload.zone_id)
    if zone is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert zone not found.")

    sns_message_id = broadcast_alert(
        district=zone.district,
        level=payload.alert_level.value,
        message=payload.message.strip(),
    )

    zone.alert_level = payload.alert_level
    zone.updated_at = datetime.utcnow()

    alert = FloodAlert(
        zone_id=zone.id,
        triggered_by=current_authority.id,
        alert_level=payload.alert_level,
        message=payload.message.strip(),
        sns_message_id=sns_message_id,
    )
    db.add(zone)
    db.add(alert)
    db.commit()
    db.refresh(alert)
    alert.zone = zone
    return flood_alert_to_out(alert)
