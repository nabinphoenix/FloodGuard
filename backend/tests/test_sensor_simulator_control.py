from datetime import datetime, timezone

from botocore.exceptions import ClientError

from models.sensor import SensorReading, SensorStation
from models.user import User, UserRole
from routers import sensors as sensors_router
from routers.auth import hash_password


class EventBridgeRuleStub:
    def __init__(self, state="DISABLED"):
        self.state = state
        self.calls = []

    def describe_rule(self, *, Name):
        self.calls.append(("describe_rule", Name))
        return {
            "Name": Name,
            "State": self.state,
            "ScheduleExpression": "rate(1 minute)",
        }

    def enable_rule(self, *, Name):
        self.calls.append(("enable_rule", Name))
        self.state = "ENABLED"

    def disable_rule(self, *, Name):
        self.calls.append(("disable_rule", Name))
        self.state = "DISABLED"


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


def make_latest_reading(db):
    station = SensorStation(
        id="SIM001",
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
        is_active=True,
    )
    reading = SensorReading(
        station_id=station.id,
        water_level=3.6,
        status="warning",
        recorded_at=datetime.now(timezone.utc),
    )
    db.add_all([station, reading])
    db.commit()
    return station, reading


def test_field_officer_can_read_simulator_status_with_latest_reading(client, db, monkeypatch):
    test_client, current_user = client
    station, reading = make_latest_reading(db)
    eventbridge = EventBridgeRuleStub("ENABLED")
    monkeypatch.setattr(sensors_router, "eventbridge_client", eventbridge)
    current_user["value"] = make_user(db, UserRole.field_officer, "sim-officer@example.com")

    response = test_client.get("/api/sensors/simulator/status")

    assert response.status_code == 200
    assert response.json() == {
        "enabled": True,
        "state": "ENABLED",
        "schedule": "rate(1 minute)",
        "latest_reading": {
            "id": reading.id,
            "station_id": station.id,
            "station_code": station.id,
            "station_name": station.name,
            "water_level": 3.6,
            "status": "warning",
            "timestamp": reading.recorded_at.isoformat(),
            "district": station.district,
            "freshness": "fresh",
        },
    }
    assert eventbridge.calls == [("describe_rule", sensors_router.settings.sensor_simulator_rule_name)]


def test_field_officer_can_start_and_stop_simulator(client, db, monkeypatch):
    test_client, current_user = client
    eventbridge = EventBridgeRuleStub()
    monkeypatch.setattr(sensors_router, "eventbridge_client", eventbridge)
    current_user["value"] = make_user(db, UserRole.field_officer, "sim-toggle@example.com")

    started = test_client.post("/api/sensors/simulator/start")
    stopped = test_client.post("/api/sensors/simulator/stop")

    assert started.status_code == 200
    assert started.json()["enabled"] is True
    assert started.json()["state"] == "ENABLED"
    assert started.json()["schedule"] == "rate(1 minute)"
    assert stopped.status_code == 200
    assert stopped.json()["enabled"] is False
    assert stopped.json()["state"] == "DISABLED"
    assert eventbridge.calls == [
        ("enable_rule", sensors_router.settings.sensor_simulator_rule_name),
        ("describe_rule", sensors_router.settings.sensor_simulator_rule_name),
        ("disable_rule", sensors_router.settings.sensor_simulator_rule_name),
        ("describe_rule", sensors_router.settings.sensor_simulator_rule_name),
    ]


def test_admin_can_control_simulator(client, db, monkeypatch):
    test_client, current_user = client
    eventbridge = EventBridgeRuleStub()
    monkeypatch.setattr(sensors_router, "eventbridge_client", eventbridge)
    current_user["value"] = make_user(db, UserRole.admin, "sim-admin@example.com")

    started = test_client.post("/api/sensors/simulator/start")
    stopped = test_client.post("/api/sensors/simulator/stop")

    assert started.status_code == 200
    assert started.json()["enabled"] is True
    assert stopped.status_code == 200
    assert stopped.json()["enabled"] is False
    assert eventbridge.calls[0][0] == "enable_rule"
    assert eventbridge.calls[2][0] == "disable_rule"


def test_citizen_and_authority_cannot_control_simulator(client, db, monkeypatch):
    test_client, current_user = client
    eventbridge = EventBridgeRuleStub()
    monkeypatch.setattr(sensors_router, "eventbridge_client", eventbridge)

    current_user["value"] = make_user(db, UserRole.public, "sim-citizen@example.com")
    assert test_client.get("/api/sensors/simulator/status").status_code == 403
    assert test_client.post("/api/sensors/simulator/start").status_code == 403

    current_user["value"] = make_user(db, UserRole.authority, "sim-authority@example.com")
    assert test_client.post("/api/sensors/simulator/stop").status_code == 403
    assert eventbridge.calls == []


def test_eventbridge_errors_are_returned_safely(client, db, monkeypatch):
    test_client, current_user = client
    current_user["value"] = make_user(db, UserRole.field_officer, "sim-error@example.com")

    class FailingEventBridge:
        def describe_rule(self, *, Name):
            raise ClientError({"Error": {"Code": "AccessDeniedException"}}, "DescribeRule")

        def enable_rule(self, *, Name):
            raise ClientError({"Error": {"Code": "AccessDeniedException"}}, "EnableRule")

    monkeypatch.setattr(sensors_router, "eventbridge_client", FailingEventBridge())

    status_response = test_client.get("/api/sensors/simulator/status")
    start_response = test_client.post("/api/sensors/simulator/start")

    assert status_response.status_code == 502
    assert status_response.json()["detail"] == "Could not read the cloud sensor simulator state."
    assert start_response.status_code == 502
    assert start_response.json()["detail"] == "Could not start the cloud sensor simulator."
