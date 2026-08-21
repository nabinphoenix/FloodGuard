from datetime import datetime, timezone

from botocore.exceptions import ClientError

from models.sensor import SensorReading
from models.user import User, UserRole
from routers import sensors as sensors_router
from routers.auth import hash_password
from services import sns_service


def field_officer(db):
    user = User(
        name="Field Officer",
        email="officer-workflow@example.com",
        password_hash=hash_password("Password123!"),
        role=UserRole.field_officer,
        email_alerts=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def station_payload(code="CRUD001"):
    return {
        "station_code": code,
        "name": "Narayani River Station",
        "province": "Bagmati",
        "district": "Chitwan",
        "river_basin": "Gandaki / Narayani Basin",
        "river_name": "Narayani",
        "latitude": 27.671,
        "longitude": 84.4305,
        "watch_threshold": 2.5,
        "warning_threshold": 3.5,
        "danger_threshold": 4.5,
    }


def test_field_officer_station_crud_and_safe_delete(client, db, monkeypatch):
    test_client, current_user = client
    current_user["value"] = field_officer(db)
    monkeypatch.setattr(sensors_router, "send_sensor_reading", lambda payload: None)
    monkeypatch.setattr(sensors_router, "publish_sensor_transition", lambda **kwargs: {
        "attempted": False, "published": False, "status": "not_sent",
    })

    created = test_client.post("/api/sensors/stations", json=station_payload())
    assert created.status_code == 200
    assert created.json()["station_code"] == "CRUD001"
    assert created.json()["status"] == "no_data"

    assert test_client.post("/api/sensors/stations", json=station_payload()).status_code == 409
    assert test_client.get("/api/sensors/stations/CRUD001").status_code == 200

    updated_payload = station_payload()
    updated_payload["name"] = "Updated Narayani Station"
    updated = test_client.put("/api/sensors/stations/CRUD001", json=updated_payload)
    assert updated.status_code == 200
    assert updated.json()["name"] == "Updated Narayani Station"

    assert test_client.put(
        "/api/sensors/stations/CRUD001/status",
        json={"is_active": False},
    ).json()["is_active"] is False
    assert test_client.put(
        "/api/sensors/stations/CRUD001/status",
        json={"is_active": True},
    ).json()["is_active"] is True

    invalid_coordinate = station_payload("CRUD002")
    invalid_coordinate["latitude"] = 91
    assert test_client.post("/api/sensors/stations", json=invalid_coordinate).status_code == 422

    invalid_thresholds = station_payload("CRUD003")
    invalid_thresholds["watch_threshold"] = 4
    assert test_client.post("/api/sensors/stations", json=invalid_thresholds).status_code == 422

    reading = test_client.post(
        "/api/sensors/reading",
        json={"station_code": "CRUD001", "water_level": 2.0},
    )
    assert reading.status_code == 200
    blocked = test_client.delete("/api/sensors/stations/CRUD001")
    assert blocked.status_code == 409
    assert "Deactivate it instead" in blocked.json()["detail"]
    assert db.query(SensorReading).count() == 1


def test_station_mutation_is_protected_from_public_user(client, db):
    test_client, current_user = client
    current_user["value"] = None
    assert test_client.get("/api/sensors/stations").status_code == 401
    assert test_client.post("/api/sensors/stations", json=station_payload()).status_code == 401


def test_sensor_transition_notification_rules(monkeypatch):
    calls = []

    def publish(**kwargs):
        calls.append(kwargs)
        return {"MessageId": "message-" + str(len(calls))}

    monkeypatch.setattr(sns_service.sns_client, "publish", publish)
    common = {
        "station_name": "Narayani River Station",
        "province": "Bagmati",
        "district": "Chitwan",
        "river_name": "Narayani",
        "water_level": 3.8,
        "watch_threshold": 2.5,
        "warning_threshold": 3.5,
        "danger_threshold": 4.5,
    }

    assert sns_service.publish_sensor_transition(**common, previous_status="safe", status="safe")["published"] is False
    assert sns_service.publish_sensor_transition(**common, previous_status="safe", status="watch")["published"] is True
    assert sns_service.publish_sensor_transition(**common, previous_status="watch", status="watch")["published"] is False
    assert sns_service.publish_sensor_transition(**common, previous_status="watch", status="warning")["published"] is True
    assert sns_service.publish_sensor_transition(**common, previous_status="warning", status="emergency")["published"] is True
    assert sns_service.publish_sensor_transition(**common, previous_status="emergency", status="emergency")["published"] is False

    recovery_common = {**common, "water_level": 1.2}
    recovery = sns_service.publish_sensor_transition(
        **recovery_common,
        previous_status="emergency",
        status="safe",
    )
    assert recovery["published"] is True
    assert "SAFE Update" in calls[-1]["Subject"]

    watch_recovery = sns_service.publish_sensor_transition(
        **recovery_common,
        previous_status="watch",
        status="safe",
    )
    assert watch_recovery["published"] is False
    assert len(calls) == 4


def test_sensor_reading_survives_unexpected_sns_failure(client, db, monkeypatch):
    test_client, current_user = client
    current_user["value"] = field_officer(db)
    test_client.post("/api/sensors/stations", json=station_payload("FAIL001"))
    monkeypatch.setattr(sensors_router, "send_sensor_reading", lambda payload: None)

    def fail(**kwargs):
        raise RuntimeError("SNS unavailable")

    monkeypatch.setattr(sensors_router, "publish_sensor_transition", fail)
    response = test_client.post(
        "/api/sensors/reading",
        json={
            "station_code": "FAIL001",
            "water_level": 3.6,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )

    assert response.status_code == 200
    assert response.json()["notification"]["published"] is False
    assert db.query(SensorReading).count() == 1
    assert db.query(SensorReading).first().status == "warning"


def test_sensor_classifier_includes_no_data():
    assert sensors_router.classify_water_level(None, 2.5, 3.5, 4.5) == "no_data"
    assert sensors_router.classify_water_level(2.49, 2.5, 3.5, 4.5) == "safe"
    assert sensors_router.classify_water_level(2.5, 2.5, 3.5, 4.5) == "watch"
    assert sensors_router.classify_water_level(3.5, 2.5, 3.5, 4.5) == "warning"
    assert sensors_router.classify_water_level(4.5, 2.5, 3.5, 4.5) == "emergency"


def test_sensor_sns_failure_returns_metadata(monkeypatch):
    def fail(**kwargs):
        raise ClientError({"Error": {"Code": "AccessDenied"}}, "Publish")

    monkeypatch.setattr(sns_service.sns_client, "publish", fail)
    result = sns_service.publish_sensor_transition(
        station_name="Narayani River Station",
        province="Bagmati",
        district="Chitwan",
        river_name="Narayani",
        water_level=3.6,
        status="warning",
        previous_status="watch",
        watch_threshold=2.5,
        warning_threshold=3.5,
        danger_threshold=4.5,
    )
    assert result["attempted"] is True
    assert result["published"] is False
    assert result["status"] == "failed"
