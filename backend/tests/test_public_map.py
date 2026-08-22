from datetime import datetime, timedelta, timezone

from models.alert import AlertLevel, AlertZone, FloodAlert
from models.report import IncidentReport, ReportStatus
from models.sensor import SensorReading, SensorStation
from models.user import User, UserRole


def test_public_map_returns_public_safe_layers(client, db):
    test_client, current_user = client
    station = SensorStation(
        id="STN-MAP",
        name="Map Station",
        province="Bagmati",
        district="Chitwan",
        river_basin="Gandaki / Narayani Basin",
        river_name="Narayani",
        latitude=27.7,
        longitude=85.3,
        watch_threshold=2.5,
        warning_threshold=3.5,
        danger_threshold=4.5,
        is_active=True,
    )
    old_reading = SensorReading(
        station_id=station.id,
        water_level=3.8,
        status="warning",
        recorded_at=datetime.now(timezone.utc) - timedelta(minutes=10),
    )
    zone = AlertZone(
        district="Chitwan",
        alert_level=AlertLevel.warning,
        latitude=27.7,
        longitude=85.3,
    )
    user = User(
        name="Map Reporter",
        email="map-reporter@example.com",
        password_hash="unused",
        role=UserRole.public,
        email_alerts=False,
    )
    report = IncidentReport(
        user=user,
        district="Chitwan",
        severity=4,
        description="Water is covering the road near the bridge.",
        latitude=27.701,
        longitude=85.301,
        status=ReportStatus.approved,
    )
    db.add_all([station, old_reading, zone, report])
    db.flush()
    db.add(
        FloodAlert(
            zone_id=zone.id,
            alert_level=AlertLevel.warning,
            message="Water levels are rising.",
            triggered_at=datetime.now(timezone.utc),
        )
    )
    db.commit()

    response = test_client.get("/api/public/map")

    assert response.status_code == 200
    payload = response.json()
    assert payload["sensors"][0]["status"] == "warning"
    assert payload["sensors"][0]["is_stale"] is True
    assert payload["zones"][0]["district"] == "Chitwan"
    assert payload["alerts"][0]["district"] == "Chitwan"
    assert payload["reports"][0]["latitude"] == 27.701
    assert "user_id" not in payload["reports"][0]
    assert current_user["value"] is None
