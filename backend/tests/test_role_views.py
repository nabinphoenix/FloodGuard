from models.user import User, UserRole
from routers.auth import hash_password


def make_user(db, name, email, role):
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


def test_admin_inherits_operational_role_access_without_role_mutation(client, db):
    test_client, current_user = client
    admin = make_user(db, "Admin", "admin-role-view@example.com", UserRole.admin)

    current_user["value"] = admin

    assert test_client.get("/api/authority/dashboard").status_code == 200
    assert test_client.get("/api/authority/zones").status_code == 200
    assert test_client.get("/api/sensors/dashboard").status_code == 200
    assert test_client.get("/api/sensors/stations").status_code == 200
    assert db.get(User, admin.id).role == UserRole.admin


def test_non_admin_roles_cannot_escalate_into_other_role_views(client, db):
    test_client, current_user = client
    authority = make_user(db, "Authority", "authority-role-view@example.com", UserRole.authority)
    field_officer = make_user(db, "Field Officer", "field-role-view@example.com", UserRole.field_officer)
    public = make_user(db, "Public", "public-role-view@example.com", UserRole.public)

    current_user["value"] = authority
    assert test_client.get("/api/authority/dashboard").status_code == 200
    assert test_client.get("/api/admin/zones").status_code == 403
    assert test_client.get("/api/sensors/dashboard").status_code == 403

    current_user["value"] = field_officer
    assert test_client.get("/api/sensors/dashboard").status_code == 200
    assert test_client.get("/api/admin/zones").status_code == 403
    assert test_client.get("/api/authority/dashboard").status_code == 403

    current_user["value"] = public
    assert test_client.get("/api/admin/zones").status_code == 403
    assert test_client.get("/api/authority/dashboard").status_code == 403
    assert test_client.get("/api/sensors/dashboard").status_code == 403


def test_only_public_users_can_submit_or_view_their_reports(client, db):
    test_client, current_user = client
    roles = [UserRole.admin, UserRole.authority, UserRole.field_officer]
    report_data = {
        "province": "Bagmati",
        "district": "Chitwan",
        "zone_id": "1",
        "severity": "3",
        "description": "Flood water is rising beside the local road.",
        "latitude": "27.67",
        "longitude": "84.43",
    }

    for role in roles:
        current_user["value"] = make_user(db, role.value.title(), f"{role.value}-report@example.com", role)
        response = test_client.post(
            "/api/reports/submit",
            data=report_data,
            files={"photo": ("report.jpg", b"fake-image", "image/jpeg")},
        )
        assert response.status_code == 403
        assert test_client.get("/api/reports/my-reports").status_code == 403
