from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, String, func
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base

if TYPE_CHECKING:
    from models.report import IncidentReport
    from models.alert import FloodAlert


class UserRole(str, Enum):
    public = "public"
    admin = "admin"
    authority = "authority"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    district: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        SqlEnum(UserRole, name="user_role"),
        nullable=False,
        default=UserRole.public,
        server_default=UserRole.public.value,
    )
    email_alerts: Mapped[bool] = mapped_column(nullable=False, default=True, server_default="1")
    sms_alerts: Mapped[bool] = mapped_column(nullable=False, default=False, server_default="0")
    sns_subscription_arn: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    reports: Mapped[list[IncidentReport]] = relationship(
        "IncidentReport",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    triggered_alerts: Mapped[list[FloodAlert]] = relationship(
        "FloodAlert",
        back_populates="triggered_by_user",
    )
