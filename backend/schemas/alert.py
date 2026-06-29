from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from models.alert import AlertLevel


class AlertZoneOut(BaseModel):
    id: int
    district: str
    alert_level: AlertLevel
    latitude: float
    longitude: float
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FloodAlertCreate(BaseModel):
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


class BroadcastRequest(BaseModel):
    zone_id: int
    alert_level: AlertLevel
    message: str = Field(..., min_length=5, max_length=2000)
