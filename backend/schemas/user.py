from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from models.user import UserRole
from schemas.common import NormalizedModel

PHONE_PATTERN = r"^[0-9]{10}$"


class UserCreate(NormalizedModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr = Field(..., max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    phone: str | None = Field(default=None, max_length=10, pattern=PHONE_PATTERN)
    district: str | None = Field(default=None, max_length=100)


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    phone: str | None
    district: str | None
    role: UserRole
    email_alerts: bool
    email_alert_status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: int
    role: UserRole


class UserUpdate(NormalizedModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    phone: str | None = Field(default=None, max_length=10, pattern=PHONE_PATTERN)
    district: str | None = Field(default=None, max_length=100)
    email_alerts: bool | None = None


class AdminUserCreate(UserCreate):
    role: UserRole = UserRole.public


class AdminUserUpdate(NormalizedModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    email: EmailStr | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=10, pattern=PHONE_PATTERN)
    district: str | None = Field(default=None, max_length=100)


class AdminUserPasswordReset(BaseModel):
    password: str = Field(..., min_length=8, max_length=128)
class ForgotPasswordRequest(NormalizedModel):
    email: EmailStr = Field(..., max_length=255)


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=20, max_length=256)
    new_password: str = Field(..., min_length=8, max_length=128)



class ProfileUpdateResponse(BaseModel):
    user: UserOut
    message: str | None = None
