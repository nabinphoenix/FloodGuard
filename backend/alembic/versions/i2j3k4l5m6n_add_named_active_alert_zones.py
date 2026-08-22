"""add named active alert zones and seed Nepal demo zones

Revision ID: i2j3k4l5m6n
Revises: h1i2j3k4l5m
Create Date: 2026-08-22
"""

from alembic import op
import sqlalchemy as sa

try:
    from data.flood_zone_seeds import ZONE_SEEDS
except ModuleNotFoundError:  # Supports Alembic inspection from the repository root.
    from backend.data.flood_zone_seeds import ZONE_SEEDS


revision = "i2j3k4l5m6n"
down_revision = "h1i2j3k4l5m"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("alert_zones", sa.Column("name", sa.String(length=150), nullable=True))
    op.add_column(
        "alert_zones",
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
    )
    op.execute(sa.text("UPDATE alert_zones SET name = district WHERE name IS NULL"))
    op.alter_column(
        "alert_zones",
        "name",
        existing_type=sa.String(length=150),
        nullable=False,
    )

    op.drop_index("ix_alert_zones_district", table_name="alert_zones")
    op.create_index("ix_alert_zones_district", "alert_zones", ["district"], unique=False)
    op.create_index("ix_alert_zones_name", "alert_zones", ["name"], unique=True)
    op.create_index("ix_alert_zones_is_active", "alert_zones", ["is_active"], unique=False)

    zones = sa.table(
        "alert_zones",
        sa.column("name", sa.String(length=150)),
        sa.column("district", sa.String(length=100)),
        sa.column("alert_level", sa.String(length=20)),
        sa.column("latitude", sa.Float()),
        sa.column("longitude", sa.Float()),
        sa.column("is_active", sa.Boolean()),
    )
    for seed in ZONE_SEEDS:
        values = sa.select(
            sa.literal(seed["name"]),
            sa.literal(seed["district"]),
            sa.literal("safe"),
            sa.literal(seed["latitude"]),
            sa.literal(seed["longitude"]),
            sa.literal(True),
        ).where(
            ~sa.exists(
                sa.select(1)
                .select_from(zones)
                .where(sa.func.lower(zones.c.name) == seed["name"].strip().casefold())
            )
        )
        op.execute(
            zones.insert().from_select(
                [
                    "name",
                    "district",
                    "alert_level",
                    "latitude",
                    "longitude",
                    "is_active",
                ],
                values,
            )
        )


def downgrade() -> None:
    connection = op.get_bind()
    duplicate_district = connection.execute(
        sa.text(
            "SELECT district FROM alert_zones "
            "GROUP BY district HAVING COUNT(*) > 1 LIMIT 1"
        )
    ).scalar()
    if duplicate_district is not None:
        raise RuntimeError(
            "Cannot restore one-zone-per-district schema while multiple zones share a district."
        )

    op.drop_index("ix_alert_zones_is_active", table_name="alert_zones")
    op.drop_index("ix_alert_zones_name", table_name="alert_zones")
    op.drop_index("ix_alert_zones_district", table_name="alert_zones")
    op.create_index("ix_alert_zones_district", "alert_zones", ["district"], unique=True)
    op.drop_column("alert_zones", "is_active")
    op.drop_column("alert_zones", "name")
