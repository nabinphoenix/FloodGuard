from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from models.alert import AlertLevel
from schemas.common import NormalizedModel


class AlertZoneOut(BaseModel):
    id: int
    name: str
    district: str
    is_active: bool
    alert_level: AlertLevel
    latitude: float
    longitude: float
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AlertZoneUpdate(NormalizedModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    district: str | None = Field(default=None, min_length=2, max_length=100)
    is_active: bool | None = None
    alert_level: AlertLevel | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)


class FloodAlertCreate(NormalizedModel):
    zone_id: int
    alert_level: AlertLevel
    message: str = Field(..., min_length=5, max_length=2000)


class FloodAlertOut(BaseModel):
    id: int
    zone_id: int
    district: str
    alert_level: AlertLevel
    message: str
    sns_message_id: str | None
    triggered_at: datetime


class BroadcastRequest(NormalizedModel):
    zone_id: int
    alert_level: AlertLevel
    message: str = Field(..., min_length=5, max_length=2000)
