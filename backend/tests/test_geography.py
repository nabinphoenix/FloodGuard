import pytest

from models.alert import AlertLevel, AlertZone
from models.user import User, UserRole
from routers.auth import hash_password
from routers import reports as reports_router
from services.geography_service import (
    load_geography,
    province_for_district,
    resolve_province_district,
)


def make_public_user(db) -> User:
    user = User(
        name="Citizen Tester",
        email="citizen-geography@example.com",
        password_hash=hash_password("Password123!"),
        role=UserRole.public,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def fake_photo():
    return {"photo": ("report.jpg", b"fake-image", "image/jpeg")}


def test_canonical_geography_has_all_nepal_provinces_and_districts():
    data = load_geography()
    provinces = data["provinces"]
    districts = [district["name"] for province in provinces for district in province["districts"]]

    assert len(provinces) == 7
    assert len(districts) == 77
    assert len({name.casefold() for name in districts}) == 77
    assert resolve_province_district("Bagmati", "Chitwan") == ("Bagmati", "Chitwan")
    assert resolve_province_district("Bagmati", "Kaski") is None
    assert province_for_district("Kaski") == "Gandaki"


def test_public_geography_endpoint_returns_cascade_shape(client):
    test_client, _ = client

    response = test_client.get("/api/public/geography")

    assert response.status_code == 200
    body = response.json()
    assert len(body["provinces"]) == 7
    bagmati = next(item for item in body["provinces"] if item["name"] == "Bagmati")
    assert {item["name"] for item in bagmati["districts"]} >= {"Chitwan", "Kathmandu"}


def test_report_submission_requires_canonical_location_and_valid_zone(client, db, monkeypatch):
    test_client, current_user = client
    current_user["value"] = make_public_user(db)
    monkeypatch.setattr(reports_router, "upload_photo", lambda *args: "incident-reports/test.jpg")
    monkeypatch.setattr(reports_router, "get_presigned_url", lambda key: "https://example.test/photo")
    zone = AlertZone(
        district="Chitwan",
        alert_level=AlertLevel.safe,
        latitude=27.67,
        longitude=84.43,
    )
    db.add(zone)
    db.commit()
    db.refresh(zone)

    valid = test_client.post(
        "/api/reports/submit",
        data={
            "province": "Bagmati",
            "district": "Chitwan",
            "zone_id": str(zone.id),
            "severity": "4",
            "description": "Flood water is rising beside the local road.",
            "latitude": "27.67",
            "longitude": "84.43",
        },
        files=fake_photo(),
    )
    assert valid.status_code == 201
    assert valid.json()["province"] == "Bagmati"
    assert valid.json()["district"] == "Chitwan"
    assert valid.json()["zone_id"] == zone.id
    assert valid.json()["zone_name"] == "Chitwan"

    missing_photo = test_client.post(
        "/api/reports/submit",
        data={
            "province": "Bagmati",
            "district": "Chitwan",
            "zone_id": str(zone.id),
            "severity": "4",
            "description": "Flood water is rising beside the local road.",
            "latitude": "27.67",
            "longitude": "84.43",
        },
    )
    assert missing_photo.status_code == 422

    wrong_district = test_client.post(
        "/api/reports/submit",
        data={
            "province": "Bagmati",
            "district": "Kaski",
            "zone_id": str(zone.id),
            "severity": "3",
            "description": "This district does not belong to Bagmati.",
            "latitude": "27.7",
            "longitude": "85.3",
        },
        files=fake_photo(),
    )
    assert wrong_district.status_code == 422
    assert "does not belong" in wrong_district.json()["detail"]

    wrong_zone = test_client.post(
        "/api/reports/submit",
        data={
            "province": "Gandaki",
            "district": "Kaski",
            "zone_id": str(zone.id),
            "severity": "3",
            "description": "The selected zone belongs to another district.",
            "latitude": "28.2",
            "longitude": "83.98",
        },
        files=fake_photo(),
    )
    assert wrong_zone.status_code == 422
    assert "does not belong to this district" in wrong_zone.json()["detail"]


@pytest.mark.parametrize(
    ("latitude", "longitude"),
    [(None, "84.43"), ("27.67", None), ("24.9", "84.43"), ("27.67", "90.0")],
)
def test_report_submission_rejects_missing_or_out_of_bounds_coordinates(
    client,
    db,
    monkeypatch,
    latitude,
    longitude,
):
    test_client, current_user = client
    current_user["value"] = make_public_user(db)
    monkeypatch.setattr(reports_router, "upload_photo", lambda *args: "incident-reports/test.jpg")
    monkeypatch.setattr(reports_router, "get_presigned_url", lambda key: "https://example.test/photo")
    zone = AlertZone(
        district="Chitwan",
        alert_level=AlertLevel.safe,
        latitude=27.67,
        longitude=84.43,
    )
    db.add(zone)
    db.commit()
    db.refresh(zone)
    data = {
        "province": "Bagmati",
        "district": "Chitwan",
        "zone_id": str(zone.id),
        "severity": "3",
        "description": "The location should be rejected by validation.",
    }
    if latitude is not None:
        data["latitude"] = latitude
    if longitude is not None:
        data["longitude"] = longitude

    response = test_client.post("/api/reports/submit", data=data, files=fake_photo())

    assert response.status_code == 422
