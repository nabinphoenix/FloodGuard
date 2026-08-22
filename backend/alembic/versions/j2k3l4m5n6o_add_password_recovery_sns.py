"""add independent password recovery SNS subscriptions

Revision ID: j2k3l4m5n6o
Revises: i2j3k4l5m6n
Create Date: 2026-08-22
"""

from alembic import op
import sqlalchemy as sa


revision = "j2k3l4m5n6o"
down_revision = "i2j3k4l5m6n"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("password_recovery_enabled", sa.Boolean(), server_default="0", nullable=False),
    )
    op.add_column("users", sa.Column("password_recovery_topic_arn", sa.String(length=255), nullable=True))
    op.add_column(
        "users",
        sa.Column("password_recovery_subscription_arn", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "password_recovery_subscription_arn")
    op.drop_column("users", "password_recovery_topic_arn")
    op.drop_column("users", "password_recovery_enabled")
