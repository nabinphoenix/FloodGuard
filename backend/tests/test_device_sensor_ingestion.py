import json

from config import settings
from models.sensor import SensorReading, SensorStation
from models.user import User, UserRole
from routers import sensors as sensors_router
from routers.auth import hash_password
from services import sqs_service

def device_headers():
    return {"X-Sensor-Token": settings.sensor_ingestion_token}



def make_station(db, station_id="DEVICE001", active=True):
    station = SensorStation(
        id=station_id,
        name="Narayani River Station",
        province="Bagmati",
        district="Chitwan",
        river_basin="Gandaki / Narayani Basin",
        river_name="Narayani",
        latitude=27.7,
        longitude=85.3,
        watch_threshold=2.5,
        warning_threshold=3.5,
        danger_threshold=4.5,
        is_active=active,
    )
    db.add(station)
    db.commit()
    db.refresh(station)
    return station


def admin_user():
    return User(
        name="Administrator",
        email="device-admin@example.com",
        password_hash=hash_password("Password123!"),
        role=UserRole.admin,
        email_alerts=False,
    )


def test_device_config_requires_token_and_returns_real_thresholds(client, db):
    test_client, current_user = client
    station = make_station(db)

    assert test_client.get(f"/api/sensors/device-stations/{station.id}").status_code == 401
    assert test_client.get(
        f"/api/sensors/device-stations/{station.id}",
        headers={"X-Sensor-Token": "wrong-token"},
    ).status_code == 401

    response = test_client.get(
        f"/api/sensors/device-stations/{station.id}",
        headers=device_headers(),
    )
    assert response.status_code == 200
    assert response.json()["watch_threshold"] == 2.5
    assert response.json()["warning_threshold"] == 3.5
    assert response.json()["danger_threshold"] == 4.5
    assert current_user["value"] is None


def test_device_reading_requires_token_even_for_authenticated_user(client, db):
    test_client, current_user = client
    station = make_station(db)
    current_user["value"] = admin_user()

    response = test_client.post(
        "/api/sensors/device-reading",
        json={"station_code": station.id, "water_level": 3.6},
    )
    assert response.status_code == 401


def test_valid_device_reading_reuses_processing_and_saves_classification(client, db, monkeypatch):
    test_client, current_user = client
    station = make_station(db)
    queued_payloads = []

    def capture_queue_payload(payload):
        # The service must commit the RDS reading before dispatching to SQS.
        assert db.query(SensorReading).count() == 1
        queued_payloads.append(payload)

    monkeypatch.setattr(sensors_router, "send_sensor_reading", capture_queue_payload)

    response = test_client.post(
        "/api/sensors/device-reading",
        headers=device_headers(),
        json={"station_code": station.id, "water_level": 3.6},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "warning"
    assert body["source"] == "simulator-aws"
    assert body["reading"]["status"] == "warning"
    assert db.query(SensorReading).count() == 1
    assert current_user["value"] is None
    assert queued_payloads == [{
        "station_id": station.id,
        "station_code": station.id,
        "station_name": station.name,
        "province": station.province,
        "district": station.district,
        "river_basin": station.river_basin,
        "river_name": station.river_name,
        "water_level": 3.6,
        "current_status": "warning",
        "previous_status": "no_data",
        "watch_threshold": 2.5,
        "warning_threshold": 3.5,
        "danger_threshold": 4.5,
        "recorded_at": db.query(SensorReading).first().recorded_at.isoformat(),
        "source": "simulator-aws",
    }]


def test_sensor_event_wrapper_uses_version_two_canonical_envelope(monkeypatch):
    request = {}

    def capture_message(**kwargs):
        request.update(kwargs)
        return {"MessageId": "sqs-message-1"}

    monkeypatch.setattr(sqs_service.sqs_client, "send_message", capture_message)

    message_id = sqs_service.send_sensor_reading({"station_id": "STN001"})

    assert message_id == "sqs-message-1"
    assert json.loads(request["MessageBody"]) == {
        "event_type": "sensor_reading",
        "event_version": 2,
        "reading": {"station_id": "STN001"},
    }


def test_device_endpoint_rejects_trusted_status_field(client, db):
    station = make_station(db)
    test_client, _ = client

    response = test_client.post(
        "/api/sensors/device-reading",
        headers=device_headers(),
        json={"station_code": station.id, "water_level": 3.6, "status": "safe"},
    )

    assert response.status_code == 422


def test_device_station_unknown_and_inactive_are_rejected(client, db):
    test_client, _ = client
    assert test_client.get(
        "/api/sensors/device-stations/MISSING",
        headers=device_headers(),
    ).status_code == 404

    station = make_station(db, station_id="INACTIVE", active=False)
    assert test_client.get(
        f"/api/sensors/device-stations/{station.id}",
        headers=device_headers(),
    ).status_code == 400
    assert test_client.post(
        "/api/sensors/device-reading",
        headers=device_headers(),
        json={"station_code": station.id, "water_level": 1.0},
    ).status_code == 400


def test_device_ingestion_is_unavailable_without_server_token(client, db, monkeypatch):
    test_client, _ = client
    make_station(db)
    monkeypatch.setattr(sensors_router.settings, "sensor_ingestion_token", "")

    response = test_client.post(
        "/api/sensors/device-reading",
        headers=device_headers(),
        json={"station_code": "DEVICE001", "water_level": 1.0},
    )

    assert response.status_code == 503
