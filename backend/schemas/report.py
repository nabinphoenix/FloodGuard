from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from models.report import ReportStatus


class ReportCreate(BaseModel):
    district: str = Field(..., min_length=2, max_length=100)
    severity: int = Field(..., ge=1, le=5)
    description: str = Field(..., min_length=10, max_length=2000)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)


class ReportOut(BaseModel):
    id: int
    user_id: int
    district: str
    severity: int
    description: str
    image_url: str | None
    status: ReportStatus
    helpful_count: int
    created_at: datetime
    user_name: str

    model_config = ConfigDict(from_attributes=True)


class ReportUpdate(BaseModel):
    status: ReportStatus
