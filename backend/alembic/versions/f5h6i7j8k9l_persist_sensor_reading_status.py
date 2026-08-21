"""persist sensor reading status for transition-safe history

Revision ID: f5h6i7j8k9l
Revises: f4g5h6i7j8k
Create Date: 2026-08-21

Adds the status captured at ingestion time. Existing rows remain valid and
continue to be classified from the station thresholds when status is null.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "f5h6i7j8k9l"
down_revision: Union[str, Sequence[str], None] = "f4g5h6i7j8k"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("sensor_readings", sa.Column("status", sa.String(length=20), nullable=True))
    op.create_index("ix_sensor_readings_status", "sensor_readings", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_sensor_readings_status", table_name="sensor_readings")
    op.drop_column("sensor_readings", "status")
