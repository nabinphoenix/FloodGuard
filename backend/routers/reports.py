from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from config import settings
from database import get_db
from models.alert import AlertZone
from models.report import IncidentReport, ReportHelpfulVote, ReportStatus
from models.user import User, UserRole
from routers.auth import ALGORITHM, get_current_user, require_exact_role
from schemas.report import ReportCreate, ReportOut
from services.geography_service import province_for_district, resolve_province_district
from services.coordinate_validation import coordinate_validation_error
from services.s3_service import delete_photo, get_presigned_url, upload_photo


router = APIRouter(prefix="/reports", tags=["reports"])
optional_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024


def get_optional_current_user(
    token: str | None = Depends(optional_oauth2_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            return None
        user = db.get(User, int(user_id))
        return user if user is not None and user.deleted_at is None else None
    except (JWTError, ValueError):
        return None


def report_to_out(
    report: IncidentReport,
    current_user: User | None = None,
    db: Session | None = None,
) -> ReportOut:
    image_url = None
    if report.image_key:
        image_url = get_presigned_url(report.image_key)

    helpful_by_me = False
    if current_user is not None and db is not None:
        helpful_by_me = db.scalar(
            select(ReportHelpfulVote).where(
                ReportHelpfulVote.report_id == report.id,
                ReportHelpfulVote.user_id == current_user.id,
            )
        ) is not None

    return ReportOut(
        id=report.id,
        user_id=report.user_id,
        province=report.province,
        district=report.district,
        zone_id=report.zone_id,
        zone_name=report.zone.name if report.zone else None,
        severity=report.severity,
        description=report.description,
        image_url=image_url,
        status=report.status,
        helpful_count=report.helpful_count,
        helpful_by_me=helpful_by_me,
        created_at=report.created_at,
        user_name=report.user.name if report.user else "Unknown user",
        latitude=report.latitude,
        longitude=report.longitude,
    )


@router.post("/submit", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
async def submit_report(
    province: str = Form(...),
    district: str = Form(...),
    zone_id: int = Form(...),
    severity: int = Form(...),
    description: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    photo: UploadFile = File(...),
    current_user: User = Depends(require_exact_role(UserRole.public)),
    db: Session = Depends(get_db),
) -> ReportOut:
    report_in = ReportCreate(
        province=province,
        district=district,
        zone_id=zone_id,
        severity=severity,
        description=description,
        latitude=latitude,
        longitude=longitude,
    )

    coordinate_error = coordinate_validation_error(
        report_in.latitude,
        report_in.longitude,
        label="Report location",
        allow_none=False,
    )
    if coordinate_error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=coordinate_error)

    geography = resolve_province_district(report_in.province, report_in.district)
    if geography is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Selected district does not belong to the selected province.",
        )
    canonical_province, canonical_district = geography
    zone = None
    if report_in.zone_id is not None:
        zone = db.get(AlertZone, report_in.zone_id)
        if zone is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Selected FloodGuard zone was not found.")
        if not zone.is_active:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Selected FloodGuard zone is inactive.")
        zone_province = province_for_district(zone.district)
        if zone_province is None or zone_province.casefold() != canonical_province.casefold():
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Selected zone does not belong to this province.")
    image_key = None
    if not photo.filename:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Photo is required.")
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

    image_key = upload_photo(file_bytes, photo.content_type, photo.filename)

    report = IncidentReport(
        user_id=current_user.id,
        province=canonical_province,
        zone_id=report_in.zone_id,
        district=canonical_district,
        severity=report_in.severity,
        description=report_in.description.strip(),
        image_key=image_key,
        latitude=report_in.latitude,
        longitude=report_in.longitude,
        status=ReportStatus.pending,
    )

    db.add(report)
    db.commit()
    db.refresh(report)

    report.user = current_user
    return report_to_out(report, current_user, db)


@router.put("/{report_id}", response_model=ReportOut)
async def update_report(
    report_id: int,
    province: str = Form(...),
    district: str = Form(...),
    zone_id: int = Form(...),
    severity: int = Form(...),
    description: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    photo: UploadFile | None = File(default=None),
    current_user: User = Depends(require_exact_role(UserRole.public)),
    db: Session = Depends(get_db),
) -> ReportOut:
    report = db.scalar(
        select(IncidentReport)
        .options(joinedload(IncidentReport.user), joinedload(IncidentReport.zone))
        .where(
            IncidentReport.id == report_id,
            IncidentReport.user_id == current_user.id,
        )
    )
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    report_in = ReportCreate(
        province=province,
        district=district,
        zone_id=zone_id,
        severity=severity,
        description=description,
        latitude=latitude,
        longitude=longitude,
    )

    coordinate_error = coordinate_validation_error(
        report_in.latitude,
        report_in.longitude,
        label="Report location",
        allow_none=False,
    )
    if coordinate_error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=coordinate_error)

    geography = resolve_province_district(report_in.province, report_in.district)
    if geography is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Selected district does not belong to the selected province.",
        )
    canonical_province, canonical_district = geography

    zone = db.get(AlertZone, report_in.zone_id)
    if zone is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Selected FloodGuard zone was not found.")
    if not zone.is_active:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Selected FloodGuard zone is inactive.")
    zone_province = province_for_district(zone.district)
    if zone_province is None or zone_province.casefold() != canonical_province.casefold():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Selected zone does not belong to this province.")

    previous_image_key = report.image_key
    image_key = previous_image_key
    if photo is not None:
        if not photo.filename:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Photo must be a valid image file.")
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
        image_key = upload_photo(file_bytes, photo.content_type, photo.filename)

    report.province = canonical_province
    report.district = canonical_district
    report.zone_id = report_in.zone_id
    report.severity = report_in.severity
    report.description = report_in.description.strip()
    report.latitude = report_in.latitude
    report.longitude = report_in.longitude
    report.image_key = image_key
    report.status = ReportStatus.pending
    report.rejection_reason = None

    db.add(report)
    db.commit()
    db.refresh(report)

    if previous_image_key and previous_image_key != image_key:
        delete_photo(previous_image_key)

    report.user = current_user
    return report_to_out(report, current_user, db)


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report(
    report_id: int,
    current_user: User = Depends(require_exact_role(UserRole.public)),
    db: Session = Depends(get_db),
) -> None:
    report = db.scalar(
        select(IncidentReport).where(
            IncidentReport.id == report_id,
            IncidentReport.user_id == current_user.id,
        )
    )
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    image_key = report.image_key
    db.delete(report)
    db.commit()

    if image_key:
        delete_photo(image_key)


@router.get("/community", response_model=list[ReportOut])
def get_community_reports(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=9, ge=1, le=30),
    district: str | None = Query(default=None),
    severity: int | None = Query(default=None, ge=1, le=5),
    current_user: User | None = Depends(get_optional_current_user),
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

    return [report_to_out(report, current_user, db) for report in reports]


@router.get("/my-reports", response_model=list[ReportOut])
def get_my_reports(
    current_user: User = Depends(require_exact_role(UserRole.public)),
    db: Session = Depends(get_db),
) -> list[ReportOut]:
    reports = db.scalars(
        select(IncidentReport)
        .options(joinedload(IncidentReport.user))
        .where(IncidentReport.user_id == current_user.id)
        .order_by(IncidentReport.created_at.desc())
    ).all()

    return [report_to_out(report, current_user, db) for report in reports]


@router.get("/{report_id}", response_model=ReportOut)
def get_report_detail(
    report_id: int,
    current_user: User | None = Depends(get_optional_current_user),
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

    return report_to_out(report, current_user, db)


@router.post("/{report_id}/helpful", response_model=ReportOut)
def toggle_report_helpful(
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

    existing_vote = db.scalar(
        select(ReportHelpfulVote).where(
            ReportHelpfulVote.report_id == report.id,
            ReportHelpfulVote.user_id == current_user.id,
        )
    )
    if existing_vote:
        db.delete(existing_vote)
        report.helpful_count = max(0, report.helpful_count - 1)
    else:
        db.add(ReportHelpfulVote(report_id=report.id, user_id=current_user.id))
        report.helpful_count += 1

    db.add(report)
    db.commit()
    db.refresh(report)
    return report_to_out(report, current_user, db)
