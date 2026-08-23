from datetime import datetime, timezone

from services.timezone_service import kathmandu_isoformat, to_kathmandu


def test_user_facing_backend_timestamps_use_kathmandu_time():
    instant = datetime(2026, 8, 23, 6, 15, tzinfo=timezone.utc)

    converted = to_kathmandu(instant)

    assert converted.tzname() == "+0545"
    assert converted.hour == 12
    assert converted.minute == 0
    assert kathmandu_isoformat(instant) == "2026-08-23T12:00:00+05:45"
