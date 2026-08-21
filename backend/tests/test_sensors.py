from datetime import datetime, timezone

from models.sensor import SensorReading, SensorStation
from models.user import User, UserRole
from routers import sensors as sensors_router
from routers.auth import hash_password
from scripts.simulate_water_level import (
    api_base_url,
    classify_level,
    parse_args,
    simulation_cycle,
)


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


def make_station(db):
    station = SensorStation(
        id="STN001",
        name="Test River",
        district="Test District",
        latitude=27.7,
        longitude=85.3,
        warning_threshold=3.5,
        danger_threshold=4.5,
        is_active=True,
    )
    db.add(station)
    db.commit()
    db.refresh(station)
    return station


def test_sensor_classification_boundaries():
    station = SensorStation(warning_threshold=3.5, danger_threshold=4.5)
    assert sensors_router.alert_level_for_reading(3.49, station).value == "safe"
    assert sensors_router.alert_level_for_reading(3.5, station).value == "warning"
    assert sensors_router.alert_level_for_reading(4.49, station).value == "warning"
    assert sensors_router.alert_level_for_reading(4.5, station).value == "emergency"


def test_live_station_without_reading_is_no_data(client, db):
    test_client, current_user = client
    make_station(db)

    response = test_client.get("/api/sensors/live")

    assert response.status_code == 200
    assert response.json()[0]["status"] == "no_data"
    assert response.json()[0]["latest_reading"] is None
    assert current_user["value"] is None


def test_sensor_roles_and_threshold_workflow(client, db, monkeypatch):
    test_client, current_user = client
    station = make_station(db)
    field_officer = make_user(db, "Field Officer", "field@example.com", UserRole.field_officer)
    admin = make_user(db, "Administrator", "admin@example.com", UserRole.admin)
    authority = make_user(db, "Authority", "authority@example.com", UserRole.authority)

    current_user["value"] = authority
    assert test_client.get("/api/sensors/stations").status_code == 403
    assert test_client.post("/api/sensors/reading", json={"station_id": station.id, "water_level": 2.0}).status_code == 403
    assert test_client.put(
        f"/api/sensors/stations/{station.id}/thresholds",
        json={"warning_threshold": 3.0, "danger_threshold": 4.0},
    ).status_code == 403

    monkeypatch.setattr(sensors_router, "send_sensor_reading", lambda payload: None)
    current_user["value"] = field_officer

    assert test_client.get("/api/sensors/stations").status_code == 200
    reading_response = test_client.post(
        "/api/sensors/reading",
        json={
            "station_id": station.id,
            "water_level": 3.5,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )
    assert reading_response.status_code == 200
    assert reading_response.json()["alert_level"] == "warning"
    assert reading_response.json()["station"]["status"] == "warning"

    threshold_response = test_client.put(
        f"/api/sensors/stations/{station.id}/thresholds",
        json={"warning_threshold": 3.0, "danger_threshold": 4.0},
    )
    assert threshold_response.status_code == 200
    assert threshold_response.json()["warning_threshold"] == 3.0

    assert test_client.get(f"/api/sensors/history/{station.id}").status_code == 200
    monkeypatch.setattr(
        sensors_router.sqs_client,
        "get_queue_attributes",
        lambda **kwargs: {"Attributes": {"ApproximateNumberOfMessages": "2"}},
    )
    assert test_client.get("/api/sensors/health").status_code == 200

    current_user["value"] = admin
    assert test_client.get("/api/sensors/stations").status_code == 200
    admin_reading = test_client.post(
        "/api/sensors/reading",
        json={"station_id": station.id, "water_level": 4.8},
    )
    assert admin_reading.status_code == 200
    assert admin_reading.json()["alert_level"] == "emergency"
    assert test_client.get("/api/sensors/health").status_code == 200
    assert test_client.put(
        f"/api/sensors/stations/{station.id}/thresholds",
        json={"warning_threshold": 3.2, "danger_threshold": 4.2},
    ).status_code == 200


def test_sensor_threshold_validation(client, db):
    test_client, current_user = client
    station = make_station(db)
    current_user["value"] = User(
        name="Field Officer",
        email="field@example.com",
        password_hash="unused",
        role=UserRole.field_officer,
        email_alerts=False,
    )

    response = test_client.put(
        f"/api/sensors/stations/{station.id}/thresholds",
        json={"warning_threshold": 4.0, "danger_threshold": 3.0},
    )

    assert response.status_code == 400
    assert "greater than or equal" in response.json()["detail"]


def test_simulator_helpers_use_api_thresholds():
    assert api_base_url("http://localhost:8000") == "http://localhost:8000/api"
    assert api_base_url("http://localhost:8000/api/") == "http://localhost:8000/api"
    assert classify_level(2.0, 3.5, 4.5) == "safe"
    assert classify_level(3.5, 3.5, 4.5) == "warning"
    assert classify_level(4.5, 3.5, 4.5) == "emergency"

    phases = simulation_cycle(3.5, 4.5)
    assert [phase for phase, _ in phases] == [
        "safe",
        "safe",
        "warning",
        "warning",
        "emergency",
        "warning",
        "safe",
    ]
    assert all(classify_level(level, 3.5, 4.5) == phase for phase, level in phases)


def test_simulator_cli_requires_station():
    args = parse_args(["--station", "STN001", "--count", "2"])
    assert args.station == "STN001"
    assert args.count == 2
