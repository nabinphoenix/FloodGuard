from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class PublicMapSensor(BaseModel):
    station_code: str
    name: str
    province: Optional[str] = None
    district: str
    river_basin: Optional[str] = None
    river_name: Optional[str] = None
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    latest_water_level: Optional[float] = None
    status: str
    last_reading_at: Optional[datetime] = None
    is_stale: bool = False
    watch_threshold: Optional[float] = None
    warning_threshold: Optional[float] = None
    emergency_threshold: Optional[float] = None


class PublicMapZone(BaseModel):
    id: int
    name: Optional[str] = None
    province: Optional[str] = None
    district: str
    alert_level: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    updated_at: datetime


class PublicMapAlert(BaseModel):
    id: int
    zone_id: int
    district: str
    alert_level: str
    message: str
    triggered_at: datetime
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class PublicMapReport(BaseModel):
    id: int
    province: Optional[str] = None
    district: str
    zone_id: Optional[int] = None
    severity: int = Field(ge=1, le=5)
    description: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    created_at: datetime


class PublicMapResponse(BaseModel):
    sensors: list[PublicMapSensor]
    zones: list[PublicMapZone]
    alerts: list[PublicMapAlert]
    reports: list[PublicMapReport]
