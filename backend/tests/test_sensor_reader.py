from models.sensor import SensorReading, SensorStation
from models.user import User, UserRole
from routers import sensors as sensors_router
from routers.auth import hash_password
from services import sns_service


def make_user(db, role, email):
    user = User(
        name=role.value.replace("_", " ").title(),
        email=email,
        password_hash=hash_password("Password123!"),
        role=role,
        email_alerts=False,
    )
    db.add(user)
    db.commit()
    return user


def make_station(db, station_id="READER001", active=True):
    station = SensorStation(
        id=station_id,
        name="Narayani River Station",
        province="Bagmati",
        district="Chitwan",
        river_basin="Gandaki / Narayani Basin",
        river_name="Narayani",
        latitude=27.671,
        longitude=84.4305,
        watch_threshold=2.5,
        warning_threshold=3.5,
        danger_threshold=4.5,
        is_active=active,
    )
    db.add(station)
    db.commit()
    return station


def request_body(station_id, pattern="rising"):
    return {"station_id": station_id, "pattern": pattern}


def reset_rate_limit(monkeypatch):
    monkeypatch.setattr(sensors_router, "_simulator_request_times", {})


def test_field_officer_generates_one_reading_persisted_and_queued(client, db, monkeypatch):
    test_client, current_user = client
    station = make_station(db)
    current_user["value"] = make_user(db, UserRole.field_officer, "reader-officer@example.com")
    reset_rate_limit(monkeypatch)
    queued = []
    monkeypatch.setattr(sensors_router, "send_sensor_reading", queued.append)

    response = test_client.post("/api/sensors/simulator/generate-reading", json=request_body(station.id))

    assert response.status_code == 200
    body = response.json()
    assert body["station_id"] == station.id
    assert body["station_name"] == station.name
    assert body["status"] == "safe"
    assert body["previous_status"] == "no_data"
    assert body["freshness"] == "fresh"
    assert db.query(SensorReading).count() == 1
    assert db.query(SensorReading).first().water_level == body["water_level"]
    assert queued[0]["station_id"] == station.id
    assert queued[0]["source"] == "interactive-reader"
    assert body["queue"] == {"queued": True, "status": "queued"}


def test_admin_can_generate_one_reading(client, db, monkeypatch):
    test_client, current_user = client
    station = make_station(db)
    current_user["value"] = make_user(db, UserRole.admin, "reader-admin@example.com")
    reset_rate_limit(monkeypatch)
    monkeypatch.setattr(sensors_router, "send_sensor_reading", lambda payload: None)

    assert test_client.post("/api/sensors/simulator/generate-reading", json=request_body(station.id, "mixed")).status_code == 200


def test_citizen_and_authority_cannot_generate_readings(client, db, monkeypatch):
    test_client, current_user = client
    station = make_station(db)
    reset_rate_limit(monkeypatch)

    current_user["value"] = make_user(db, UserRole.public, "reader-citizen@example.com")
    assert test_client.post("/api/sensors/simulator/generate-reading", json=request_body(station.id)).status_code == 403

    current_user["value"] = make_user(db, UserRole.authority, "reader-authority@example.com")
    assert test_client.post("/api/sensors/simulator/generate-reading", json=request_body(station.id)).status_code == 403
    assert db.query(SensorReading).count() == 0


def test_invalid_or_inactive_station_is_rejected(client, db, monkeypatch):
    test_client, current_user = client
    current_user["value"] = make_user(db, UserRole.field_officer, "reader-invalid@example.com")
    reset_rate_limit(monkeypatch)

    assert test_client.post("/api/sensors/simulator/generate-reading", json=request_body("MISSING")).status_code == 404
    inactive = make_station(db, station_id="INACTIVE", active=False)
    assert test_client.post("/api/sensors/simulator/generate-reading", json=request_body(inactive.id)).status_code == 400
    assert test_client.post("/api/sensors/simulator/generate-reading", json=request_body("READER001", "invalid")).status_code == 422


def test_rising_falling_and_mixed_patterns_use_station_thresholds(db, monkeypatch):
    station = make_station(db)

    assert sensors_router.generate_interactive_water_level(station, "rising", None) < station.watch_threshold
    rising_watch = sensors_router.generate_interactive_water_level(station, "rising", 2.4)
    assert station.watch_threshold <= rising_watch < station.warning_threshold
    rising_warning = sensors_router.generate_interactive_water_level(station, "rising", 3.4)
    assert station.warning_threshold <= rising_warning < station.danger_threshold
    assert sensors_router.generate_interactive_water_level(station, "rising", 4.4) >= station.danger_threshold

    falling_warning = sensors_router.generate_interactive_water_level(station, "falling", 4.8)
    assert station.warning_threshold <= falling_warning < station.danger_threshold
    falling_watch = sensors_router.generate_interactive_water_level(station, "falling", 4.0)
    assert station.watch_threshold <= falling_watch < station.warning_threshold
    assert sensors_router.generate_interactive_water_level(station, "falling", 3.0) < station.watch_threshold

    monkeypatch.setattr(sensors_router.random, "uniform", lambda lower, upper: upper)
    mixed = sensors_router.generate_interactive_water_level(station, "mixed", 3.0)
    assert 3.0 < mixed < station.danger_threshold


def test_generated_status_is_classified_with_the_station_thresholds(client, db, monkeypatch):
    test_client, current_user = client
    station = make_station(db)
    current_user["value"] = make_user(db, UserRole.field_officer, "reader-status@example.com")
    reset_rate_limit(monkeypatch)
    monkeypatch.setattr(sensors_router, "send_sensor_reading", lambda payload: None)
    monkeypatch.setattr(
        sensors_router,
        "generate_interactive_water_level",
        lambda selected_station, pattern, previous_level: selected_station.warning_threshold,
    )

    response = test_client.post("/api/sensors/simulator/generate-reading", json=request_body(station.id))

    assert response.status_code == 200
    assert response.json()["water_level"] == station.warning_threshold
    assert response.json()["status"] == "warning"


def test_interactive_reader_does_not_publish_sns_directly(client, db, monkeypatch):
    test_client, current_user = client
    station = make_station(db)
    current_user["value"] = make_user(db, UserRole.field_officer, "reader-sqs@example.com")
    reset_rate_limit(monkeypatch)
    queued = []
    monkeypatch.setattr(sensors_router, "send_sensor_reading", queued.append)
    monkeypatch.setattr(
        sns_service,
        "publish_sensor_transition",
        lambda **kwargs: (_ for _ in ()).throw(AssertionError("FastAPI must not publish SNS directly")),
    )

    response = test_client.post("/api/sensors/simulator/generate-reading", json=request_body(station.id, "falling"))

    assert response.status_code == 200
    assert len(queued) == 1
    assert queued[0]["source"] == "interactive-reader"


def test_reader_endpoint_rate_limits_rapid_calls(client, db, monkeypatch):
    test_client, current_user = client
    station = make_station(db)
    current_user["value"] = make_user(db, UserRole.field_officer, "reader-limit@example.com")
    reset_rate_limit(monkeypatch)
    monkeypatch.setattr(sensors_router, "send_sensor_reading", lambda payload: None)

    assert test_client.post("/api/sensors/simulator/generate-reading", json=request_body(station.id)).status_code == 200
    repeated = test_client.post("/api/sensors/simulator/generate-reading", json=request_body(station.id))

    assert repeated.status_code == 429
