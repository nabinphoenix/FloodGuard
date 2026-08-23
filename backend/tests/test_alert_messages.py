from datetime import datetime, timezone

import pytest

from services.alert_message_service import build_flood_alert_message
from services.sns_service import sensor_transition_requires_notification


STATION = {
    "name": "Narayani River Station",
    "station_code": "NAR-001",
    "province": "Bagmati",
    "district": "Chitwan",
    "river_name": "Narayani",
}


@pytest.mark.parametrize("severity", ["watch", "warning", "emergency", "safe"])
def test_alert_message_builder_has_actionable_level_specific_content(severity):
    formatted = build_flood_alert_message(
        severity=severity,
        station=STATION,
        water_level=3.8,
        thresholds={"watch": 2.5, "warning": 3.5, "danger": 4.5},
        timestamp=datetime(2026, 8, 22, 6, 30, tzinfo=timezone.utc),
    )

    assert f"Status: {severity.upper()}" in formatted.plain_text_body
    assert "Automated Sensor Alert" in formatted.plain_text_body
    assert "Narayani River Station" in formatted.plain_text_body
    assert "Province: Bagmati" in formatted.plain_text_body
    assert "District: Chitwan" in formatted.plain_text_body
    assert "FloodGuard Support Contacts" in formatted.plain_text_body
    assert "2026-08-22 12:15 NPT" in formatted.plain_text_body
    assert "Nabin Nepali" in formatted.plain_text_body
    assert "https://" in formatted.plain_text_body or "http://" in formatted.plain_text_body
    assert len(formatted.subject) <= 100


def test_official_message_is_preserved_and_labelled():
    formatted = build_flood_alert_message(
        severity="warning",
        zone={"district": "Chitwan"},
        alert_source="Official FloodGuard Alert",
        optional_authority_message="Move away from the riverbank.",
    )

    assert formatted.subject == "FloodGuard WARNING Alert - Chitwan"
    assert "Official FloodGuard Alert" in formatted.plain_text_body
    assert "Move away from the riverbank." in formatted.plain_text_body


def test_sensor_transition_gate_preserves_required_anti_spam_rules():
    cases = {
        ("safe", "safe"): False,
        ("safe", "watch"): True,
        ("watch", "watch"): False,
        ("watch", "warning"): True,
        ("warning", "warning"): False,
        ("warning", "emergency"): True,
        ("emergency", "emergency"): False,
        ("warning", "safe"): True,
        ("emergency", "safe"): True,
        ("watch", "safe"): False,
    }
    for (previous, current), expected in cases.items():
        assert sensor_transition_requires_notification(previous, current) is expected
