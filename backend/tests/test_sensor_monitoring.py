from datetime import datetime, timedelta, timezone

from models.sensor import SensorReading, SensorStation
from models.user import User, UserRole
from routers.auth import hash_password
from services.sensor_monitoring import reading_freshness, water_level_trend


def make_field_officer(db) -> User:
    user = User(
        name="Monitoring Officer",
        email="monitoring-officer@example.com",
        password_hash=hash_password("Password123!"),
        role=UserRole.field_officer,
        email_alerts=False,
    )
    db.add(user)
    db.commit()
    return user


def make_station(db, station_id="MON001") -> SensorStation:
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
        is_active=True,
    )
    db.add(station)
    db.commit()
    return station


def test_reading_freshness_boundaries_and_trend():
    now = datetime(2026, 8, 23, 12, 0, tzinfo=timezone.utc)
    assert reading_freshness(None, now=now) == "no_reading"
    assert reading_freshness(now - timedelta(seconds=119), now=now) == "fresh"
    assert reading_freshness(now - timedelta(seconds=120), now=now) == "delayed"
    assert reading_freshness(now - timedelta(minutes=5), now=now) == "delayed"
    assert reading_freshness(now - timedelta(minutes=5, seconds=1), now=now) == "stale"
    assert water_level_trend(3.6, 3.2) == "rising"
    assert water_level_trend(3.2, 3.6) == "falling"
    assert water_level_trend(3.2, 3.2) == "steady"
    assert water_level_trend(3.2, None) == "unavailable"


def test_live_readings_require_field_officer_and_include_latest_trend(client, db):
    test_client, current_user = client
    station = make_station(db)
    now = datetime.now(timezone.utc)
    db.add_all([
        SensorReading(station_id=station.id, water_level=3.1, status="watch", recorded_at=now - timedelta(minutes=1)),
        SensorReading(station_id=station.id, water_level=3.7, status="warning", recorded_at=now),
    ])
    db.commit()

    assert test_client.get("/api/sensors/live").status_code == 401
    current_user["value"] = make_field_officer(db)

    response = test_client.get("/api/sensors/live")
    assert response.status_code == 200
    body = response.json()[0]
    assert body["latest_reading"]["water_level"] == 3.7
    assert body["latest_reading"]["status"] == "warning"
    assert body["previous_reading"]["water_level"] == 3.1
    assert body["trend"] == "rising"
    assert body["freshness"] == "fresh"


def test_no_reading_and_stale_reading_are_separate_from_threshold_status(client, db):
    test_client, current_user = client
    no_reading = make_station(db, "EMPTY001")
    stale = make_station(db, "STALE001")
    db.add(SensorReading(
        station_id=stale.id,
        water_level=3.7,
        status="warning",
        recorded_at=datetime.now(timezone.utc) - timedelta(minutes=6),
    ))
    db.commit()
    current_user["value"] = make_field_officer(db)

    body = {item["id"]: item for item in test_client.get("/api/sensors/live").json()}
    assert body[no_reading.id]["status"] == "no_data"
    assert body[no_reading.id]["freshness"] == "no_reading"
    assert body[stale.id]["status"] == "warning"
    assert body[stale.id]["freshness"] == "stale"


def test_history_is_protected_and_returns_readings_in_time_order(client, db):
    test_client, current_user = client
    station = make_station(db)
    now = datetime.now(timezone.utc)
    db.add_all([
        SensorReading(station_id=station.id, water_level=2.1, status="safe", recorded_at=now - timedelta(minutes=2)),
        SensorReading(station_id=station.id, water_level=2.7, status="watch", recorded_at=now - timedelta(minutes=1)),
    ])
    db.commit()

    assert test_client.get(f"/api/sensors/history/{station.id}").status_code == 401
    current_user["value"] = make_field_officer(db)
    response = test_client.get(f"/api/sensors/history/{station.id}")

    assert response.status_code == 200
    readings = response.json()["readings"]
    assert [item["status"] for item in readings] == ["safe", "watch"]
    assert readings[0]["timestamp"] < readings[1]["timestamp"]
