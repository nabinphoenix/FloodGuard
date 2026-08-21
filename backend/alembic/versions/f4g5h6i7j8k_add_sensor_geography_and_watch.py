"""add sensor geography and watch threshold

Revision ID: f4g5h6i7j8k
Revises: e1cafcdba358
Create Date: 2026-08-21

Adds optional geography metadata and a nullable watch threshold to the
existing sensor_stations table. Existing station identities and readings are
preserved; known seed stations are backfilled without inventing unknown
geography. The migration also leaves one Alembic head after the earlier
image-key/field-officer merge.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f4g5h6i7j8k"
down_revision: Union[str, Sequence[str], None] = "f2a4b6c7d8e9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("sensor_stations", sa.Column("province", sa.String(length=100), nullable=True))
    op.add_column("sensor_stations", sa.Column("river_basin", sa.String(length=150), nullable=True))
    op.add_column("sensor_stations", sa.Column("river_name", sa.String(length=150), nullable=True))
    op.add_column("sensor_stations", sa.Column("watch_threshold", sa.Float(), nullable=True))

    op.create_index("ix_sensor_stations_province", "sensor_stations", ["province"], unique=False)
    op.create_index("ix_sensor_stations_river_basin", "sensor_stations", ["river_basin"], unique=False)
    op.create_index("ix_sensor_stations_river_name", "sensor_stations", ["river_name"], unique=False)

    # These mappings are unambiguous from the existing station ID/name/district.
    op.execute(
        """
        UPDATE sensor_stations
        SET province = 'Bagmati',
            river_basin = 'Gandaki / Narayani Basin',
            river_name = 'Narayani',
            watch_threshold = CASE
                WHEN warning_threshold > 0 THEN warning_threshold - 1.0
                ELSE NULL
            END
        WHERE id = 'STN001' AND district = 'Chitwan'
        """
    )
    op.execute(
        """
        UPDATE sensor_stations
        SET province = 'Bagmati',
            river_basin = 'Bagmati Basin',
            river_name = 'Bagmati',
            watch_threshold = CASE
                WHEN warning_threshold > 0 THEN warning_threshold - 1.0
                ELSE NULL
            END
        WHERE id = 'STN002' AND district = 'Kathmandu'
        """
    )
    op.execute(
        """
        UPDATE sensor_stations
        SET province = 'Gandaki',
            river_basin = 'Gandaki / Narayani Basin',
            river_name = 'Seti',
            watch_threshold = CASE
                WHEN warning_threshold > 0 THEN warning_threshold - 1.0
                ELSE NULL
            END
        WHERE id = 'STN003' AND district = 'Kaski'
        """
    )

    # Preserve legacy rows while giving every positive warning threshold a
    # usable watch band. Unknown geography remains NULL for later review.
    op.execute(
        """
        UPDATE sensor_stations
        SET watch_threshold = warning_threshold - 1.0
        WHERE watch_threshold IS NULL AND warning_threshold > 0
        """
    )


def downgrade() -> None:
    op.drop_index("ix_sensor_stations_river_name", table_name="sensor_stations")
    op.drop_index("ix_sensor_stations_river_basin", table_name="sensor_stations")
    op.drop_index("ix_sensor_stations_province", table_name="sensor_stations")
    op.drop_column("sensor_stations", "watch_threshold")
    op.drop_column("sensor_stations", "river_name")
    op.drop_column("sensor_stations", "river_basin")
    op.drop_column("sensor_stations", "province")
