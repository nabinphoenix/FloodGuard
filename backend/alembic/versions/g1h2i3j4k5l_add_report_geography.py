"""add province and floodguard zone to incident reports

Revision ID: g1h2i3j4k5l
Revises: f5h6i7j8k9l
Create Date: 2026-08-22
"""

from alembic import op
import sqlalchemy as sa


revision = "g1h2i3j4k5l"
down_revision = "f5h6i7j8k9l"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("incident_reports", sa.Column("province", sa.String(length=100), nullable=True))
    op.add_column("incident_reports", sa.Column("zone_id", sa.Integer(), nullable=True))
    op.create_index("ix_incident_reports_province", "incident_reports", ["province"], unique=False)
    op.create_index("ix_incident_reports_zone_id", "incident_reports", ["zone_id"], unique=False)
    op.create_foreign_key(
        "fk_incident_reports_zone_id_alert_zones",
        "incident_reports",
        "alert_zones",
        ["zone_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_incident_reports_zone_id_alert_zones",
        "incident_reports",
        type_="foreignkey",
    )
    op.drop_index("ix_incident_reports_zone_id", table_name="incident_reports")
    op.drop_index("ix_incident_reports_province", table_name="incident_reports")
    op.drop_column("incident_reports", "zone_id")
    op.drop_column("incident_reports", "province")
