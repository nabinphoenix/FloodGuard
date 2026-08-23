from models.alert import AlertLevel, AlertZone
from models.report import IncidentReport, ReportStatus
from models.user import User, UserRole
from routers.auth import hash_password
from routers import reports as reports_router


def make_user(db, name, email):
    user = User(
        name=name,
        email=email,
        password_hash=hash_password("Password123!"),
        role=UserRole.public,
        email_alerts=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def make_zone(db):
    zone = AlertZone(
        district="Chitwan",
        name="Chitwan Flood Zone",
        alert_level=AlertLevel.safe,
        latitude=27.67,
        longitude=84.43,
    )
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone


def make_report(db, user, zone):
    report = IncidentReport(
        user_id=user.id,
        province="Bagmati",
        district="Chitwan",
        zone_id=zone.id,
        severity=2,
        description="Original flood report description.",
        image_key="incident-reports/original.jpg",
        latitude=27.67,
        longitude=84.43,
        status=ReportStatus.approved,
        rejection_reason="Old rejection reason",
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def report_form(zone_id, description="Updated flood report description."):
    return {
        "province": "Bagmati",
        "district": "Chitwan",
        "zone_id": str(zone_id),
        "severity": "4",
        "description": description,
        "latitude": "27.68",
        "longitude": "84.44",
    }


def test_public_user_can_update_own_report_and_restarts_review(client, db, monkeypatch):
    test_client, current_user = client
    user = make_user(db, "Report Owner", "report-owner@example.com")
    zone = make_zone(db)
    report = make_report(db, user, zone)
    current_user["value"] = user
    monkeypatch.setattr(reports_router, "get_presigned_url", lambda key: f"https://example.test/{key}")

    response = test_client.put(f"/api/reports/{report.id}", data=report_form(zone.id))

    assert response.status_code == 200
    assert response.json()["description"] == "Updated flood report description."
    assert response.json()["severity"] == 4
    assert response.json()["status"] == ReportStatus.pending.value
    assert response.json()["image_url"].endswith("incident-reports/original.jpg")

    db.refresh(report)
    assert report.status == ReportStatus.pending
    assert report.rejection_reason is None
    assert report.image_key == "incident-reports/original.jpg"


def test_public_user_can_delete_own_report_but_not_another_users_report(client, db, monkeypatch):
    test_client, current_user = client
    owner = make_user(db, "Owner", "owner@example.com")
    other_user = make_user(db, "Other User", "other@example.com")
    zone = make_zone(db)
    report = make_report(db, owner, zone)
    deleted_keys = []
    monkeypatch.setattr(reports_router, "delete_photo", deleted_keys.append)

    current_user["value"] = other_user
    assert test_client.put(f"/api/reports/{report.id}", data=report_form(zone.id)).status_code == 404
    assert test_client.delete(f"/api/reports/{report.id}").status_code == 404
    assert db.get(IncidentReport, report.id) is not None

    current_user["value"] = owner
    response = test_client.delete(f"/api/reports/{report.id}")

    assert response.status_code == 204
    assert db.get(IncidentReport, report.id) is None
    assert deleted_keys == ["incident-reports/original.jpg"]
