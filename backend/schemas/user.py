from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from models.user import UserRole


class UserCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    phone: str | None = Field(default=None, max_length=30)
    district: str | None = Field(default=None, max_length=100)


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    phone: str | None
    district: str | None
    role: UserRole
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: int
    role: UserRole


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    phone: str | None = Field(default=None, max_length=30)
    district: str | None = Field(default=None, max_length=100)
    email_alerts: bool | None = None
    sms_alerts: bool | None = None
