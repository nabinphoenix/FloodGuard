from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from models.alert import AlertLevel, AlertZone, FloodAlert
from models.report import IncidentReport, ReportStatus
from models.user import User, UserRole
from routers import admin as admin_router
from routers import authority as authority_router
from routers.auth import hash_password
from schemas.alert import AlertZoneUpdate
from services import sns_service
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
    subscribe_mock = MagicMock()
    monkeypatch.setattr(sns_service, "subscribe_email", subscribe_mock)

    created = admin_router.create_user(
        AdminUserCreate(
            name="New User",
            email="NEW@example.com",
            password="NewPassword123!",
            role=UserRole.authority,
        ),
        db,
    )
    assert created.email == "new@example.com"
    assert created.email_alerts is False
    assert created.sns_subscription_arn is None
    assert created.email_alert_status == "disabled"
    subscribe_mock.assert_not_called()
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


def test_admin_cannot_edit_email_alert_preference(db):
    admin = make_user(db, "Admin", "admin@example.com", UserRole.admin)
    user = make_user(db, "Public", "public@example.com")

    payload = AdminUserUpdate(name="Updated", email_alerts=True)
    assert "email_alerts" not in payload.model_dump()

    updated = admin_router.update_user(user.id, payload, db)
    assert updated.name == "Updated"
    assert updated.email_alerts is False
    assert updated.sns_subscription_arn is None
    assert "email_alerts" not in AdminUserCreate.model_fields
    assert "email_alerts" not in AdminUserUpdate.model_fields


def test_admin_email_change_resets_sns_state_without_resubscribing(db, monkeypatch):
    make_user(db, "Admin", "admin@example.com", UserRole.admin)
    user = make_user(db, "Subscribed", "old@example.com")
    user.email_alerts = True
    user.sns_subscription_arn = "arn:aws:sns:us-east-1:123456789012:confirmed-subscription"
    db.commit()

    unsubscribe_mock = MagicMock()
    subscribe_mock = MagicMock()
    monkeypatch.setattr(admin_router, "unsubscribe", unsubscribe_mock)
    monkeypatch.setattr(sns_service, "subscribe_email", subscribe_mock)

    updated = admin_router.update_user(
        user.id,
        AdminUserUpdate(email="new@example.com"),
        db,
    )

    assert updated.email == "new@example.com"
    assert updated.email_alerts is False
    assert updated.sns_subscription_arn is None
    unsubscribe_mock.assert_called_once_with(
        "arn:aws:sns:us-east-1:123456789012:confirmed-subscription"
    )
    subscribe_mock.assert_not_called()


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


def test_zone_route_rbac_and_authority_broadcast(client, db, monkeypatch):
    test_client, current_user = client
    admin = make_user(db, "Admin", "admin@example.com", UserRole.admin)
    authority = make_user(db, "Authority", "authority@example.com", UserRole.authority)
    public = make_user(db, "Public", "public@example.com", UserRole.public)
    zone = admin_router.create_zone(
        admin_router.AlertZoneCreate(
            district="Chitwan area",
            alert_level=AlertLevel.safe,
            latitude=27.67,
            longitude=84.43,
        ),
        db,
    )

    current_user["value"] = admin
    admin_response = test_client.get("/api/admin/zones")
    assert admin_response.status_code == 200
    assert admin_response.json()[0]["district"] == "Chitwan area"
    assert test_client.get("/admin/zones").status_code != 401

    current_user["value"] = authority
    assert test_client.get("/api/admin/zones").status_code == 403
    authority_response = test_client.get("/api/authority/zones")
    assert authority_response.status_code == 200
    assert authority_response.json()[0]["district"] == "Chitwan area"

    monkeypatch.setattr(authority_router, "broadcast_alert", lambda **kwargs: "sns-route-1")
    broadcast_response = test_client.post(
        "/api/authority/broadcast-alert",
        json={
            "zone_id": zone.id,
            "alert_level": "warning",
            "message": "Water levels are rising in Chitwan area.",
        },
    )
    assert broadcast_response.status_code == 201
    assert broadcast_response.json()["sns_message_id"] == "sns-route-1"

    current_user["value"] = public
    assert test_client.get("/api/authority/zones").status_code == 403
