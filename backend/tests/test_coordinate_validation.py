from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

from models.alert import AlertLevel, AlertZone, FloodAlert
from models.report import IncidentReport, ReportStatus
from models.sensor import SensorStation
from models.user import User, UserRole
from routers.admin import AlertZoneCreate, create_zone
from routers.sensors import StationPayload, _validate_geography
from services.coordinate_validation import (
    coordinate_validation_error,
    is_valid_coordinate,
    is_within_nepal_operational_bounds,
)


def test_coordinate_validation_separates_global_and_nepal_operational_rules():
    assert is_valid_coordinate(12, 134)
    assert not is_valid_coordinate(float("nan"), 84)
    assert is_within_nepal_operational_bounds(27.671, 84.4305)
    assert not is_within_nepal_operational_bounds(12, 134)
    assert coordinate_validation_error(None, None, allow_none=True) is None
    assert "provided together" in coordinate_validation_error(27.7, None)


def test_sensor_and_zone_writes_reject_out_of_nepal_coordinates(db):
    sensor = StationPayload(
        station_code="STN-OUT",
        name="Out of area station",
        province="Bagmati",
        district="Chitwan",
        river_basin="Gandaki / Narayani Basin",
        river_name="Narayani",
        latitude=12,
        longitude=134,
        watch_threshold=2.5,
        warning_threshold=3.5,
        danger_threshold=4.5,
    )
    with pytest.raises(HTTPException, match="within Nepal"):
        _validate_geography(sensor)

    zone = AlertZoneCreate(
        district="Out of area",
        alert_level=AlertLevel.warning,
        latitude=3.15,
        longitude=101.65,
    )
    with pytest.raises(HTTPException, match="within Nepal"):
        create_zone(zone, db)


def test_public_map_omits_invalid_historical_locations(client, db):
    test_client, _ = client
    valid_station = SensorStation(
        id="STN-VALID",
        name="Valid station",
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
    invalid_station = SensorStation(
        id="STN-INVALID",
        name="Invalid station",
        province="Bagmati",
        district="Kathmandu",
        river_basin="Bagmati Basin",
        river_name="Bagmati",
        latitude=12,
        longitude=134,
        watch_threshold=2.5,
        warning_threshold=3.5,
        danger_threshold=4.5,
        is_active=True,
    )
    valid_zone = AlertZone(
        district="Kaski",
        alert_level=AlertLevel.warning,
        latitude=28.2096,
        longitude=83.9856,
    )
    invalid_zone = AlertZone(
        district="Bad zone",
        alert_level=AlertLevel.warning,
        latitude=3.15,
        longitude=101.65,
    )
    user = User(
        name="Map tester",
        email="coordinate-map@example.com",
        password_hash="unused",
        role=UserRole.public,
        email_alerts=False,
    )
    valid_report = IncidentReport(
        user=user,
        district="Chitwan",
        severity=4,
        description="Valid report with a Nepal location.",
        latitude=27.7,
        longitude=84.4,
        status=ReportStatus.approved,
    )
    invalid_report = IncidentReport(
        user=user,
        district="Bad report",
        severity=4,
        description="Historical report with a non-Nepal location.",
        latitude=3.15,
        longitude=101.65,
        status=ReportStatus.approved,
    )
    db.add_all([valid_station, invalid_station, valid_zone, invalid_zone, valid_report, invalid_report])
    db.flush()
    db.add_all(
        [
            FloodAlert(
                zone_id=valid_zone.id,
                alert_level=AlertLevel.warning,
                message="Valid zone alert.",
                triggered_at=datetime.now(timezone.utc),
            ),
            FloodAlert(
                zone_id=invalid_zone.id,
                alert_level=AlertLevel.warning,
                message="Invalid zone alert.",
                triggered_at=datetime.now(timezone.utc),
            ),
        ]
    )
    db.commit()

    response = test_client.get("/api/public/map")

    assert response.status_code == 200
    payload = response.json()
    assert [item["station_code"] for item in payload["sensors"]] == ["STN-VALID"]
    assert [item["district"] for item in payload["zones"]] == ["Kaski"]
    assert [item["district"] for item in payload["alerts"]] == ["Kaski"]
    assert [item["id"] for item in payload["reports"]] == [valid_report.id]
