"""fix invalid Kathmandu Area alert zone coordinates

Revision ID: k3l4m5n6o7p
Revises: j2k3l4m5n6o
Create Date: 2026-08-23
"""

from alembic import op
import sqlalchemy as sa


revision = "k3l4m5n6o7p"
down_revision = "j2k3l4m5n6o"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE alert_zones
            SET
                district = 'Kathmandu',
                latitude = 27.7172,
                longitude = 85.3240
            WHERE lower(name) = 'kathmandu area'
               OR (
                    lower(district) = 'kathmandu area'
                    AND latitude = -3
                    AND longitude = 8
               )
            """
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE alert_zones
            SET
                district = 'Kathmandu Area',
                latitude = -3,
                longitude = 8
            WHERE lower(name) = 'kathmandu area'
              AND district = 'Kathmandu'
              AND latitude = 27.7172
              AND longitude = 85.3240
            """
        )
    )
