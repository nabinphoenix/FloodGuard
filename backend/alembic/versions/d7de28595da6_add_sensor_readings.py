"""add_sensor_readings

Adds the ``sensor_readings`` relational table to replace DynamoDB as the
persistence layer for water-level sensor measurements.

Schema:
    sensor_readings
    ├── id            INTEGER PK (auto-increment)
    ├── station_id    VARCHAR(20) FK → sensor_stations.id  ON DELETE CASCADE
    ├── water_level   FLOAT NOT NULL
    ├── recorded_at   DATETIME (tz-aware) NOT NULL  — canonical measurement timestamp
    └── created_at    DATETIME (tz-aware) NOT NULL  server_default=now()

Indexes:
    ix_sensor_readings_id                  on id
    ix_sensor_readings_recorded_at         on recorded_at
    ix_sensor_readings_station_recorded    COMPOSITE on (station_id, recorded_at)
        — used by both the latest-per-station subquery (GET /sensors/live,
          GET /sensors/stations) and the ordered history query
          (GET /sensors/history/{station_id}).

Revision ID: d7de28595da6
Revises: 7fc78ddcb2a2
Create Date: 2026-08-20
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d7de28595da6"
down_revision: Union[str, Sequence[str], None] = "7fc78ddcb2a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the sensor_readings table."""
    op.create_table(
        "sensor_readings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("station_id", sa.String(length=20), nullable=False),
        sa.Column("water_level", sa.Float(), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["station_id"],
            ["sensor_stations.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    # Single-column indexes.
    op.create_index(op.f("ix_sensor_readings_id"), "sensor_readings", ["id"], unique=False)
    op.create_index(op.f("ix_sensor_readings_recorded_at"), "sensor_readings", ["recorded_at"], unique=False)
    # Composite index for efficient station-specific queries ordered by time.
    op.create_index(
        "ix_sensor_readings_station_recorded",
        "sensor_readings",
        ["station_id", "recorded_at"],
        unique=False,
    )


def downgrade() -> None:
    """Drop the sensor_readings table."""
    op.drop_index("ix_sensor_readings_station_recorded", table_name="sensor_readings")
    op.drop_index(op.f("ix_sensor_readings_recorded_at"), table_name="sensor_readings")
    op.drop_index(op.f("ix_sensor_readings_id"), table_name="sensor_readings")
    op.drop_table("sensor_readings")
