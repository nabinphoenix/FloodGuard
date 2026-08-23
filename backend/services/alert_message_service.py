from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Mapping

from config import settings
from services.geography_service import province_for_district
from services.support_contacts import format_support_contacts
from services.timezone_service import to_kathmandu


@dataclass(frozen=True)
class FloodAlertMessage:
    subject: str
    plain_text_body: str


def _value(source: Any, key: str) -> Any:
    if source is None:
        return None
    if isinstance(source, Mapping):
        return source.get(key)
    return getattr(source, key, None)


def _clean(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _format_timestamp(value: datetime | None) -> str | None:
    if value is None:
        return None
    return to_kathmandu(value).strftime("%Y-%m-%d %H:%M NPT")


def _format_threshold(value: Any) -> str | None:
    if value is None:
        return None
    try:
        return f"{float(value):.2f} m"
    except (TypeError, ValueError):
        return _clean(value)


def _location_details(station: Any, zone: Any) -> tuple[str, list[str]]:
    station_name = _clean(_value(station, "name"))
    station_code = _clean(_value(station, "station_code")) or _clean(_value(station, "id"))
    river = _clean(_value(station, "river_name"))
    district = _clean(_value(station, "district")) or _clean(_value(zone, "district"))
    province = _clean(_value(station, "province")) or province_for_district(district)
    zone_name = _clean(_value(zone, "name")) or _clean(_value(zone, "district"))

    location_parts = []
    if river:
        location_parts.append(river)
    if district:
        location_parts.append(district)
    subject_location = ", ".join(location_parts) or station_name or zone_name or "FloodGuard"

    details: list[str] = []
    if station_name or station_code:
        station_label = station_name or "Not configured"
        if station_code and station_code != station_name:
            station_label += f" ({station_code})"
        details.append(f"Station: {station_label}")
    if river:
        details.append(f"River: {river}")
    if province:
        details.append(f"Province: {province}")
    if district:
        details.append(f"District: {district}")
    if zone_name:
        details.append(f"FloodGuard Zone: {zone_name}")
    return subject_location, details


def _guidance(severity: str) -> tuple[str, list[str]]:
    normalized = severity.casefold()
    if normalized == "watch":
        return (
            "What this means:",
            [
                "Water levels have reached the FloodGuard WATCH threshold. Conditions may continue to change.",
                "Stay informed through FloodGuard and official local announcements.",
                "Keep your phone charged and prepare essential medicines, identification, water and basic supplies.",
                "Move important documents and valuables away from low areas.",
                "Keep children and vulnerable family members away from rivers, drains and fast-moving water.",
                "Review the safest route to higher ground.",
                "Do not panic. Continue monitoring the situation.",
            ],
        )
    if normalized == "warning":
        return (
            "What you should do:",
            [
                "Stay calm and be ready to move to safer or higher ground.",
                "Keep an emergency bag ready and keep children and older family members close.",
                "Avoid riverbanks, bridges with fast water, drainage channels and flooded roads.",
                "Do not attempt to cross moving floodwater.",
                "Follow instructions from local authorities and keep monitoring FloodGuard updates.",
            ],
        )
    if normalized == "emergency":
        return (
            "Immediate action:",
            [
                "Stay calm and act quickly.",
                "Move to safer or higher ground if flooding threatens your location or authorities advise evacuation.",
                "Follow official evacuation instructions and keep children, older adults and vulnerable people with you.",
                "Never walk, swim or drive through floodwater.",
                "Stay away from riverbanks, damaged roads, bridges and electrical hazards.",
                "Take essential medicines, identification and communication devices if it is safe to do so.",
                "Do not return to a flooded area until authorities say it is safe.",
            ],
        )
    return (
        "Important:",
        [
            "Water levels have returned below the active FloodGuard warning thresholds.",
            "Continue following instructions from local authorities.",
            "Do not immediately enter previously flooded buildings or roads if they have not been declared safe.",
            "Stay alert for damaged roads, unstable structures and electrical hazards.",
            "Use safe drinking water and continue monitoring FloodGuard in case conditions change again.",
        ],
    )


def build_flood_alert_message(
    *,
    severity: str,
    station: Any = None,
    zone: Any = None,
    water_level: float | None = None,
    thresholds: Mapping[str, Any] | None = None,
    alert_source: str = "Automated Sensor Alert",
    timestamp: datetime | None = None,
    optional_authority_message: str | None = None,
) -> FloodAlertMessage:
    """Build the single plain-text format used by automated and official alerts."""
    normalized = severity.casefold()
    display_severity = normalized.upper()
    subject_location, location_details = _location_details(station, zone)
    is_recovery = normalized == "safe"
    if is_recovery and alert_source == "Automated Sensor Alert":
        subject = f"FloodGuard Sensor SAFE Update - {subject_location}"
        title = "FLOODGUARD RECOVERY UPDATE"
    elif is_recovery:
        subject = f"FloodGuard Recovery Update - {subject_location}"
        title = "FLOODGUARD RECOVERY UPDATE"
    else:
        subject = f"FloodGuard {display_severity} Alert - {subject_location}"
        title = f"FLOODGUARD {display_severity} FLOOD ALERT"

    lines = [title, "", f"Alert source: {alert_source}", ""]
    if location_details:
        lines.extend(("Location:", *location_details, ""))
    if water_level is not None:
        lines.append(f"Current water level: {float(water_level):.2f} m")
    lines.append(f"Status: {display_severity}")

    threshold_values = thresholds or {}
    threshold_lines = [
        ("Watch threshold", threshold_values.get("watch")),
        ("Warning threshold", threshold_values.get("warning")),
        ("Emergency threshold", threshold_values.get("emergency") or threshold_values.get("danger")),
    ]
    formatted_thresholds = [
        f"{label}: {formatted}"
        for label, value in threshold_lines
        if (formatted := _format_threshold(value)) is not None
    ]
    if formatted_thresholds:
        lines.extend(("", *formatted_thresholds))

    if optional_authority_message and optional_authority_message.strip():
        lines.extend(
            (
                "",
                "Official message from FloodGuard Authority:",
                optional_authority_message.strip(),
            )
        )

    heading, guidance = _guidance(normalized)
    lines.extend(("", heading, ""))
    for item in guidance:
        lines.append(f"- {item}")

    formatted_time = _format_timestamp(timestamp)
    if formatted_time:
        lines.extend(("", f"Timestamp: {formatted_time}"))

    lines.extend(
        (
            "",
            format_support_contacts(),
            "",
            "For immediate life-safety emergencies, follow instructions from local authorities and official emergency services.",
            "",
            f"FloodGuard: {settings.frontend_base_url.rstrip('/')}",
        )
    )
    return FloodAlertMessage(subject=subject[:100], plain_text_body="\n".join(lines))
