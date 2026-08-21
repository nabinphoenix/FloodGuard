from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base

if TYPE_CHECKING:
    from models.sensor import SensorReading


class SensorStation(Base):
    __tablename__ = "sensor_stations"
    __table_args__ = (
        CheckConstraint(
            "watch_threshold IS NULL OR watch_threshold >= 0",
            name="ck_sensor_stations_watch_threshold_nonnegative",
        ),
        CheckConstraint(
            "watch_threshold IS NULL OR watch_threshold < warning_threshold",
            name="ck_sensor_stations_watch_threshold_before_warning",
        ),
        CheckConstraint(
            "warning_threshold >= 0",
            name="ck_sensor_stations_warning_threshold_nonnegative",
        ),
        CheckConstraint(
            "danger_threshold > warning_threshold",
            name="ck_sensor_stations_danger_threshold_valid",
        ),
    )

    # Existing id/name columns remain the station code/name for compatibility.
    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    province: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    district: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    river_basin: Mapped[str | None] = mapped_column(String(150), nullable=True, index=True)
    river_name: Mapped[str | None] = mapped_column(String(150), nullable=True, index=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    watch_threshold: Mapped[float | None] = mapped_column(Float, nullable=True)
    warning_threshold: Mapped[float] = mapped_column(Float, nullable=False)
    danger_threshold: Mapped[float] = mapped_column(Float, nullable=False)
    is_active: Mapped[bool] = mapped_column(nullable=False, default=True, server_default="1")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    readings: Mapped[list[SensorReading]] = relationship(
        "SensorReading",
        back_populates="station",
        cascade="all, delete-orphan",
        order_by="SensorReading.recorded_at",
    )


class SensorReading(Base):
    """A single water-level measurement stored in the relational database."""

    __tablename__ = "sensor_readings"
    __table_args__ = (
        Index("ix_sensor_readings_station_recorded", "station_id", "recorded_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    station_id: Mapped[str] = mapped_column(
        String(20),
        ForeignKey("sensor_stations.id", ondelete="CASCADE"),
        nullable=False,
    )
    water_level: Mapped[float] = mapped_column(Float, nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    station: Mapped[SensorStation] = relationship("SensorStation", back_populates="readings")
