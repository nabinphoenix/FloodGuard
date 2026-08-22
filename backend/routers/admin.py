from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import get_db
from models.alert import AlertLevel, AlertZone, FloodAlert
from models.report import IncidentReport
from models.user import User, UserRole
from routers.auth import hash_password, require_role
from schemas.common import NormalizedModel
from schemas.alert import AlertZoneOut, AlertZoneUpdate
from schemas.user import (
    AdminUserCreate,
    AdminUserPasswordReset,
    AdminUserUpdate,
    UserOut,
)
from services.coordinate_validation import coordinate_validation_error
from services.geography_service import resolve_district
from services.sns_service import is_subscription_pending, unsubscribe


router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_role(UserRole.admin))],
)


class AlertZoneCreate(NormalizedModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    district: str = Field(..., min_length=2, max_length=100)
    is_active: bool = True
    alert_level: AlertLevel = AlertLevel.safe
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class UserRoleUpdate(BaseModel):
    role: UserRole


def user_to_out(user: User) -> UserOut:
    return UserOut.model_validate(user)


def _normalise_email(email: str) -> str:
    return email.strip().lower()


def _ensure_email_available(db: Session, email: str, exclude_user_id: int | None = None) -> None:
    query = select(User).where(func.lower(User.email) == email)
    if exclude_user_id is not None:
        query = query.where(User.id != exclude_user_id)
    if db.scalar(query):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )


def _unsubscribe_if_needed(subscription_arn: str | None) -> None:
    if subscription_arn and not is_subscription_pending(subscription_arn):
        unsubscribe(subscription_arn)


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


@router.get("/zones/{zone_id}", response_model=AlertZoneOut)
def get_zone(zone_id: int, db: Session = Depends(get_db)) -> AlertZone:
    zone = db.get(AlertZone, zone_id)
    if zone is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert zone not found.")
    return zone


@router.post("/zones", response_model=AlertZoneOut, status_code=status.HTTP_201_CREATED)
def create_zone(zone_in: AlertZoneCreate, db: Session = Depends(get_db)) -> AlertZone:
    coordinate_error = coordinate_validation_error(
        zone_in.latitude,
        zone_in.longitude,
        label="Zone location",
    )
    if coordinate_error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=coordinate_error)

    name = zone_in.name.strip() if zone_in.name else ""
    geography = resolve_district(zone_in.district)
    if geography is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Select a valid Nepal district for this alert zone.",
        )
    _, district = geography
    if not name:
        name = district
    existing_zone = db.scalar(
        select(AlertZone).where(func.lower(AlertZone.name) == name.lower())
    )
    if existing_zone:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An alert zone with this name already exists.",
        )

    zone = AlertZone(
        name=name,
        district=district,
        is_active=zone_in.is_active,
        alert_level=zone_in.alert_level,
        latitude=zone_in.latitude,
        longitude=zone_in.longitude,
    )
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone


@router.put("/zones/{zone_id}", response_model=AlertZoneOut)
def update_zone(
    zone_id: int,
    zone_in: AlertZoneUpdate,
    db: Session = Depends(get_db),
) -> AlertZone:
    zone = db.get(AlertZone, zone_id)
    if zone is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert zone not found.")

    update_data = zone_in.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one zone field must be provided.",
        )

    coordinate_error = coordinate_validation_error(
        update_data.get("latitude", zone.latitude),
        update_data.get("longitude", zone.longitude),
        label="Zone location",
    )
    if coordinate_error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=coordinate_error)

    if "name" in update_data:
        name = update_data["name"].strip()
        if not name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Zone name cannot be empty.",
            )
        existing_zone = db.scalar(
            select(AlertZone).where(
                func.lower(AlertZone.name) == name.lower(),
                AlertZone.id != zone_id,
            )
        )
        if existing_zone:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An alert zone with this name already exists.",
            )
        update_data["name"] = name

    if "district" in update_data:
        geography = resolve_district(update_data["district"])
        if geography is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Select a valid Nepal district for this alert zone.",
            )
        _, update_data["district"] = geography

    for field, value in update_data.items():
        setattr(zone, field, value)
    zone.updated_at = datetime.now(timezone.utc)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not update the alert zone because of a data conflict.",
        ) from exc
    db.refresh(zone)
    return zone


@router.delete("/zones/{zone_id}")
def delete_zone(zone_id: int, db: Session = Depends(get_db)) -> dict[str, str]:
    zone = db.get(AlertZone, zone_id)
    if zone is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert zone not found.")
    if (
        db.scalar(select(func.count(FloodAlert.id)).where(FloodAlert.zone_id == zone_id)) or 0
    ) > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This alert zone cannot be deleted because historical alerts depend on it.",
        )

    db.delete(zone)
    db.commit()
    return {"message": "Alert zone deleted successfully."}


@router.get("/users", response_model=list[UserOut])
def get_users(db: Session = Depends(get_db)) -> list[UserOut]:
    users = db.scalars(select(User).order_by(User.created_at.desc())).all()
    return [user_to_out(user) for user in users]


@router.get("/users/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db)) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return user


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(user_in: AdminUserCreate, db: Session = Depends(get_db)) -> User:
    email = _normalise_email(user_in.email)
    _ensure_email_available(db, email)
    name = user_in.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Name cannot be empty.")

    user = User(
        name=name,
        email=email,
        phone=user_in.phone.strip() if user_in.phone else None,
        district=user_in.district.strip() if user_in.district else None,
        password_hash=hash_password(user_in.password),
        role=user_in.role,
        email_alerts=False,
        sns_subscription_arn=None,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        ) from exc
    db.refresh(user)
    return user


@router.put("/users/{user_id}", response_model=UserOut)
def update_user(user_id: int, user_in: AdminUserUpdate, db: Session = Depends(get_db)) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    update_data = user_in.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one user field must be provided.",
        )

    old_email = user.email
    new_email = _normalise_email(update_data.get("email", old_email))
    _ensure_email_available(db, new_email, exclude_user_id=user.id)
    if "name" in update_data:
        update_data["name"] = update_data["name"].strip()
        if not update_data["name"]:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Name cannot be empty.")
    for field in ("phone", "district"):
        if field in update_data and isinstance(update_data[field], str):
            update_data[field] = update_data[field].strip() or None

    if new_email != old_email:
        _unsubscribe_if_needed(user.sns_subscription_arn)
        user.sns_subscription_arn = None
        user.email_alerts = False

    update_data["email"] = new_email
    for field, value in update_data.items():
        setattr(user, field, value)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not update the user because of a data conflict.",
        ) from exc
    db.refresh(user)
    return user


@router.put("/users/{user_id}/role", response_model=UserOut)
def update_user_role(
    user_id: int,
    payload: UserRoleUpdate,
    current_admin: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if user.id == current_admin.id and payload.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot remove your own administrator role.",
        )
    if user.role == UserRole.admin and payload.role != UserRole.admin:
        admin_count = db.scalar(select(func.count(User.id)).where(User.role == UserRole.admin)) or 0
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The final administrator cannot be demoted.",
            )

    user.role = payload.role
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/{user_id}/reset-password", response_model=UserOut)
def reset_user_password(user_id: int, payload: AdminUserPasswordReset, db: Session = Depends(get_db)) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    user.password_hash = hash_password(payload.password)
    user.password_changed_at = datetime.now(timezone.utc).replace(microsecond=0)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    current_admin: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if user.id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own administrator account.",
        )
    if user.role == UserRole.admin:
        admin_count = db.scalar(select(func.count(User.id)).where(User.role == UserRole.admin)) or 0
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The final administrator cannot be deleted.",
            )
    report_count = db.scalar(
        select(func.count(IncidentReport.id)).where(IncidentReport.user_id == user.id)
    ) or 0
    if report_count:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This user cannot be deleted because their historical reports must be preserved.",
        )

    _unsubscribe_if_needed(user.sns_subscription_arn)
    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully."}
