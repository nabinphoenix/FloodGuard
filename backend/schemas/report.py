from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from schemas.common import NormalizedModel

from models.report import ReportStatus


class ReportCreate(NormalizedModel):
    province: str = Field(..., min_length=2, max_length=100)
    district: str = Field(..., min_length=2, max_length=100)
    zone_id: int = Field(..., gt=0)
    severity: int = Field(..., ge=1, le=5)
    description: str = Field(..., min_length=10, max_length=2000)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class ReportOut(BaseModel):
    id: int
    user_id: int
    province: str | None = None
    district: str
    zone_id: int | None = None
    zone_name: str | None = None
    severity: int
    description: str
    image_url: str | None
    status: ReportStatus
    helpful_count: int
    helpful_by_me: bool = False
    created_at: datetime
    user_name: str
    latitude: float | None = None
    longitude: float | None = None

    model_config = ConfigDict(from_attributes=True)


class ReportUpdate(BaseModel):
    status: ReportStatus
