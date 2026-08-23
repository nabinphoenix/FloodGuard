from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, String, func
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base

if TYPE_CHECKING:
    from models.report import IncidentReport, ReportHelpfulVote
    from models.alert import FloodAlert
    from models.password_reset import PasswordResetToken


class UserRole(str, Enum):
    public = "public"
    admin = "admin"
    authority = "authority"
    field_officer = "field_officer"


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
    email_alerts: Mapped[bool] = mapped_column(nullable=False, default=False, server_default="0")
    sns_subscription_arn: Mapped[str | None] = mapped_column(String(255), nullable=True)
    password_recovery_enabled: Mapped[bool] = mapped_column(nullable=False, default=False, server_default="0")
    password_recovery_topic_arn: Mapped[str | None] = mapped_column(String(255), nullable=True)
    password_recovery_subscription_arn: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    password_changed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
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
    reset_tokens: Mapped[list[PasswordResetToken]] = relationship(
        "PasswordResetToken",
        cascade="all, delete-orphan",
    )
    helpful_votes: Mapped[list[ReportHelpfulVote]] = relationship(
        "ReportHelpfulVote",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    @property
    def email_alert_status(self) -> str:
        """Return a conservative user-facing SNS email subscription state.

        The stored ARN records a subscription request, but Subscribe returning
        successfully does not prove that the recipient followed SNS's email
        confirmation link.  Confirmation is therefore never inferred from
        the stored value alone.
        """
        if not self.email_alerts or not self.sns_subscription_arn:
            return "disabled"
        return "pending"

    @property
    def password_recovery_status(self) -> str:
        if not self.password_recovery_enabled or not self.password_recovery_topic_arn:
            return "disabled"
        if not self.password_recovery_subscription_arn or self.password_recovery_subscription_arn == "PendingConfirmation":
            return "pending"
        return "confirmed"
