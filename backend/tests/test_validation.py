import pytest
from pydantic import ValidationError

from routers.admin import AlertZoneCreate
from routers.authority import RejectReportRequest
from schemas.alert import AlertZoneUpdate, BroadcastRequest
from schemas.report import ReportCreate
from schemas.user import UserCreate, UserUpdate


def valid_user(**overrides):
    payload = {
        "name": "FloodGuard User",
        "email": "User@Example.COM",
        "password": "Password123!",
        "district": "Kathmandu",
    }
    payload.update(overrides)
    return payload


def test_phone_exactly_ten_digits_is_accepted_and_normalized():
    user = UserCreate(**valid_user(phone="9812345678"))
    assert user.phone == "9812345678"
    assert user.email == "user@example.com"
    assert UserCreate(**valid_user(phone="")).phone is None


@pytest.mark.parametrize(
    "phone",
    [
        "123456789",
        "12345678901",
        "+9779812345678",
        "98123 45678",
        "98123-45678",
        "abc9812345",
    ],
)
def test_invalid_phone_formats_are_rejected(phone):
    with pytest.raises(ValidationError):
        UserCreate(**valid_user(phone=phone))
    with pytest.raises(ValidationError):
        UserUpdate(phone=phone)


def test_coordinate_boundaries_are_accepted():
    assert AlertZoneCreate(district="North", latitude=-90, longitude=-180).latitude == -90
    assert AlertZoneUpdate(latitude=90, longitude=180).longitude == 180
    assert ReportCreate(district="North", severity=1, description="A valid report description.", latitude=-90, longitude=180).latitude == -90


@pytest.mark.parametrize("latitude", [-91, 91])
def test_latitude_outside_range_is_rejected(latitude):
    with pytest.raises(ValidationError):
        AlertZoneCreate(district="North", latitude=latitude, longitude=0)
    with pytest.raises(ValidationError):
        ReportCreate(district="North", severity=1, description="A valid report description.", latitude=latitude)


@pytest.mark.parametrize("longitude", [-181, 181])
def test_longitude_outside_range_is_rejected(longitude):
    with pytest.raises(ValidationError):
        AlertZoneCreate(district="North", latitude=0, longitude=longitude)
    with pytest.raises(ValidationError):
        ReportCreate(district="North", severity=1, description="A valid report description.", longitude=longitude)


def test_non_numeric_coordinate_is_rejected():
    with pytest.raises(ValidationError):
        AlertZoneCreate(district="North", latitude="not-a-number", longitude=0)


def test_narrative_limits_and_whitespace_required_fields_are_enforced():
    with pytest.raises(ValidationError):
        ReportCreate(district="North", severity=1, description="x" * 2001)
    with pytest.raises(ValidationError):
        BroadcastRequest(zone_id=1, alert_level="warning", message="x" * 2001)
    with pytest.raises(ValidationError):
        RejectReportRequest(reason="   ")
    with pytest.raises(ValidationError):
        ReportCreate(district="   ", severity=1, description="A valid report description.")
