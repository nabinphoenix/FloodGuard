from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base

if TYPE_CHECKING:
    from models.user import User


class AlertLevel(str, Enum):
    safe = "safe"
    watch = "watch"
    warning = "warning"
    emergency = "emergency"


class AlertZone(Base):
    __tablename__ = "alert_zones"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    district: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    alert_level: Mapped[AlertLevel] = mapped_column(
        SqlEnum(AlertLevel, name="alert_level"),
        nullable=False,
        default=AlertLevel.safe,
        server_default=AlertLevel.safe.value,
        index=True,
    )
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    alerts: Mapped[list[FloodAlert]] = relationship(
        "FloodAlert",
        back_populates="zone",
        cascade="all, delete-orphan",
    )


class FloodAlert(Base):
    __tablename__ = "flood_alerts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    zone_id: Mapped[int] = mapped_column(ForeignKey("alert_zones.id", ondelete="CASCADE"), nullable=False, index=True)
    triggered_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    alert_level: Mapped[AlertLevel] = mapped_column(
        SqlEnum(AlertLevel, name="flood_alert_level"),
        nullable=False,
        index=True,
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    sns_message_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    triggered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )

    zone: Mapped[AlertZone] = relationship("AlertZone", back_populates="alerts")
    triggered_by_user: Mapped[User | None] = relationship(
        "User",
        back_populates="triggered_alerts",
    )
