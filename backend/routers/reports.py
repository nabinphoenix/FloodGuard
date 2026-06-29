from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models.report import IncidentReport, ReportStatus
from models.user import User
from routers.auth import get_current_user
from schemas.report import ReportCreate, ReportOut
from services.s3_service import upload_photo
from services.sqs_service import notify_admin_new_report


router = APIRouter(prefix="/reports", tags=["reports"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024


def report_to_out(report: IncidentReport) -> ReportOut:
    return ReportOut(
        id=report.id,
        user_id=report.user_id,
        district=report.district,
        severity=report.severity,
        description=report.description,
        image_url=report.image_url,
        status=report.status,
        helpful_count=report.helpful_count,
        created_at=report.created_at,
        user_name=report.user.name if report.user else "Unknown user",
    )


@router.post("/submit", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
async def submit_report(
    district: str = Form(...),
    severity: int = Form(...),
    description: str = Form(...),
    latitude: float | None = Form(default=None),
    longitude: float | None = Form(default=None),
    photo: UploadFile | None = File(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportOut:
    report_in = ReportCreate(
        district=district,
        severity=severity,
        description=description,
        latitude=latitude,
        longitude=longitude,
    )

    image_url = None
    if photo and photo.filename:
        if photo.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Photo must be a JPEG, PNG, or WebP image.",
            )

        file_bytes = await photo.read()
        if len(file_bytes) > MAX_PHOTO_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Photo must be 5 MB or smaller.",
            )

        image_url = upload_photo(file_bytes, photo.content_type, photo.filename)

    report = IncidentReport(
        user_id=current_user.id,
        district=report_in.district.strip(),
        severity=report_in.severity,
        description=report_in.description.strip(),
        image_url=image_url,
        latitude=report_in.latitude,
        longitude=report_in.longitude,
        status=ReportStatus.pending,
    )

    db.add(report)
    db.commit()
    db.refresh(report)

    notify_admin_new_report(report.id, report.district, report.severity)

    report.user = current_user
    return report_to_out(report)


@router.get("/community", response_model=list[ReportOut])
def get_community_reports(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=9, ge=1, le=30),
    district: str | None = Query(default=None),
    severity: int | None = Query(default=None, ge=1, le=5),
    db: Session = Depends(get_db),
) -> list[ReportOut]:
    query = (
        select(IncidentReport)
        .options(joinedload(IncidentReport.user))
        .where(IncidentReport.status == ReportStatus.approved)
    )

    if district:
        query = query.where(IncidentReport.district == district)
    if severity:
        query = query.where(IncidentReport.severity == severity)

    reports = db.scalars(
        query.order_by(IncidentReport.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    ).all()

    return [report_to_out(report) for report in reports]


@router.get("/my-reports", response_model=list[ReportOut])
def get_my_reports(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ReportOut]:
    reports = db.scalars(
        select(IncidentReport)
        .options(joinedload(IncidentReport.user))
        .where(IncidentReport.user_id == current_user.id)
        .order_by(IncidentReport.created_at.desc())
    ).all()

    return [report_to_out(report) for report in reports]


@router.get("/{report_id}", response_model=ReportOut)
def get_report_detail(report_id: int, db: Session = Depends(get_db)) -> ReportOut:
    report = db.scalar(
        select(IncidentReport)
        .options(joinedload(IncidentReport.user))
        .where(IncidentReport.id == report_id)
    )

    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found.",
        )

    return report_to_out(report)


@router.post("/{report_id}/helpful", response_model=ReportOut)
def mark_report_helpful(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportOut:
    report = db.scalar(
        select(IncidentReport)
        .options(joinedload(IncidentReport.user))
        .where(IncidentReport.id == report_id)
    )

    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found.",
        )

    report.helpful_count += 1
    db.add(report)
    db.commit()
    db.refresh(report)
    return report_to_out(report)
