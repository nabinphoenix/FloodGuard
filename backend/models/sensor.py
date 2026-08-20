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
        CheckConstraint("warning_threshold >= 0", name="ck_sensor_stations_warning_threshold_nonnegative"),
        CheckConstraint("danger_threshold >= warning_threshold", name="ck_sensor_stations_danger_threshold_valid"),
    )

    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    district: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    warning_threshold: Mapped[float] = mapped_column(Float, nullable=False)
    danger_threshold: Mapped[float] = mapped_column(Float, nullable=False)
    is_active: Mapped[bool] = mapped_column(nullable=False, default=True, server_default="1")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # One station has many readings.
    readings: Mapped[list[SensorReading]] = relationship(
        "SensorReading",
        back_populates="station",
        cascade="all, delete-orphan",
        order_by="SensorReading.recorded_at",
    )


class SensorReading(Base):
    """A single water-level measurement from a sensor station.

    ``recorded_at`` is the authoritative timestamp for the measurement
    (either the time provided by the sensor or the UTC time the reading
    was received by the API).  ``created_at`` is the database insert time.

    The composite index on ``(station_id, recorded_at)`` makes the common
    query patterns — latest reading per station and ordered history for a
    station — efficient.
    """

    __tablename__ = "sensor_readings"
    __table_args__ = (
        # Composite index used by: latest-per-station subquery, history query.
        Index("ix_sensor_readings_station_recorded", "station_id", "recorded_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    station_id: Mapped[str] = mapped_column(
        String(20),
        ForeignKey("sensor_stations.id", ondelete="CASCADE"),
        nullable=False,
    )
    water_level: Mapped[float] = mapped_column(Float, nullable=False)
    # The canonical measurement timestamp (tz-aware).  Stored as provided by
    # the sensor; falls back to UTC now() when the sensor omits it.
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    # DB insert time — useful for auditing lag between measurement and ingestion.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    station: Mapped[SensorStation] = relationship("SensorStation", back_populates="readings")
