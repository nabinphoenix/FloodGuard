import pytest
from fastapi import HTTPException

from models.alert import AlertLevel, AlertZone, FloodAlert
from models.report import IncidentReport, ReportStatus
from models.user import User, UserRole
from routers import admin as admin_router
from routers.auth import hash_password
from schemas.alert import AlertZoneUpdate
from schemas.user import (
    AdminUserCreate,
    AdminUserPasswordReset,
    AdminUserUpdate,
)


def make_user(db, name, email, role=UserRole.public):
    user = User(
        name=name,
        email=email,
        password_hash=hash_password("Password123!"),
        role=role,
        email_alerts=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_user_crud_and_safe_delete(db, monkeypatch):
    admin = make_user(db, "Admin", "admin@example.com", UserRole.admin)
    monkeypatch.setattr(admin_router, "subscribe_email", lambda email: "PendingConfirmation")

    created = admin_router.create_user(
        AdminUserCreate(
            name="New User",
            email="NEW@example.com",
            password="NewPassword123!",
            role=UserRole.authority,
            email_alerts=True,
        ),
        db,
    )
    assert created.email == "new@example.com"
    assert created.email_alert_status == "pending"
    assert admin_router.get_user(created.id, db).email == "new@example.com"

    updated = admin_router.update_user(
        created.id,
        AdminUserUpdate(name="Updated User", district="Kathmandu"),
        db,
    )
    assert updated.name == "Updated User"
    assert updated.district == "Kathmandu"

    role_updated = admin_router.update_user_role(
        created.id,
        admin_router.UserRoleUpdate(role=UserRole.field_officer),
        admin,
        db,
    )
    assert role_updated.role == UserRole.field_officer

    reset = admin_router.reset_user_password(
        created.id,
        AdminUserPasswordReset(password="ResetPassword123!"),
        db,
    )
    assert reset.password_hash != "ResetPassword123!"

    admin_router.delete_user(created.id, admin, db)
    assert db.get(User, created.id) is None


def test_user_with_historical_report_cannot_be_deleted(db):
    admin = make_user(db, "Admin", "admin@example.com", UserRole.admin)
    reporter = make_user(db, "Reporter", "reporter@example.com")
    db.add(
        IncidentReport(
            user_id=reporter.id,
            district="Kathmandu",
            severity=3,
            description="Water is rising near the road.",
            status=ReportStatus.approved,
        )
    )
    db.commit()

    with pytest.raises(HTTPException) as exc:
        admin_router.delete_user(reporter.id, admin, db)
    assert exc.value.status_code == 409
    assert db.get(User, reporter.id) is not None


def test_self_delete_and_final_admin_protection(db):
    admin = make_user(db, "Admin", "admin@example.com", UserRole.admin)

    with pytest.raises(HTTPException) as delete_exc:
        admin_router.delete_user(admin.id, admin, db)
    assert delete_exc.value.status_code == 400

    with pytest.raises(HTTPException) as role_exc:
        admin_router.update_user_role(
            admin.id,
            admin_router.UserRoleUpdate(role=UserRole.public),
            admin,
            db,
        )
    assert role_exc.value.status_code == 400


def test_zone_crud_and_historical_alert_protection(db):
    admin = make_user(db, "Admin", "admin@example.com", UserRole.admin)
    zone = admin_router.create_zone(
        admin_router.AlertZoneCreate(
            district="Kathmandu",
            alert_level=AlertLevel.watch,
            latitude=27.7,
            longitude=85.3,
        ),
        db,
    )
    assert admin_router.get_zone(zone.id, db).district == "Kathmandu"

    updated = admin_router.update_zone(
        zone.id,
        AlertZoneUpdate(district="Lalitpur", alert_level=AlertLevel.warning),
        db,
    )
    assert updated.district == "Lalitpur"
    assert updated.alert_level == AlertLevel.warning

    db.add(
        FloodAlert(
            zone_id=zone.id,
            triggered_by=admin.id,
            alert_level=AlertLevel.warning,
            message="Historical alert",
            sns_message_id="sns-1",
        )
    )
    db.commit()

    with pytest.raises(HTTPException) as exc:
        admin_router.delete_zone(zone.id, db)
    assert exc.value.status_code == 409
    assert db.get(AlertZone, zone.id) is not None
