from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base

if TYPE_CHECKING:
    from models.alert import AlertZone
    from models.user import User


class ReportStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class IncidentReport(Base):
    __tablename__ = "incident_reports"
    __table_args__ = (
        CheckConstraint("severity BETWEEN 1 AND 5", name="ck_incident_reports_severity_range"),
        CheckConstraint("helpful_count >= 0", name="ck_incident_reports_helpful_count_nonnegative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    province: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    district: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    zone_id: Mapped[int | None] = mapped_column(
        ForeignKey("alert_zones.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    severity: Mapped[int] = mapped_column(nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    image_key: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ReportStatus] = mapped_column(
        SqlEnum(ReportStatus, name="report_status"),
        nullable=False,
        default=ReportStatus.pending,
        server_default=ReportStatus.pending.value,
        index=True,
    )
    helpful_count: Mapped[int] = mapped_column(nullable=False, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )

    user: Mapped[User] = relationship("User", back_populates="reports")
    zone: Mapped[AlertZone | None] = relationship("AlertZone")
    helpful_votes: Mapped[list[ReportHelpfulVote]] = relationship(
        "ReportHelpfulVote",
        back_populates="report",
        cascade="all, delete-orphan",
    )


class ReportHelpfulVote(Base):
    __tablename__ = "report_helpful_votes"
    __table_args__ = (
        UniqueConstraint("report_id", "user_id", name="uq_report_helpful_votes_report_user"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("incident_reports.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    report: Mapped[IncidentReport] = relationship("IncidentReport", back_populates="helpful_votes")
    user: Mapped[User] = relationship("User", back_populates="helpful_votes")
