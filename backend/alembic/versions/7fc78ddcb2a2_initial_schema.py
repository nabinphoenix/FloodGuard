"""initial_schema

Baseline migration capturing the complete FloodGuard schema as it exists at
project initialisation.  This migration is equivalent to what
``Base.metadata.create_all()`` used to produce automatically.

Tables created:
    users
    alert_zones
    flood_alerts
    incident_reports
    sensor_stations

Revision ID: 7fc78ddcb2a2
Revises:
Create Date: 2026-08-20 09:26:31.715996

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7fc78ddcb2a2"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the full initial schema."""

    # ------------------------------------------------------------------
    # users
    # ------------------------------------------------------------------
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=30), nullable=True),
        sa.Column("district", sa.String(length=100), nullable=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column(
            "role",
            sa.Enum("public", "admin", "authority", name="user_role"),
            server_default="public",
            nullable=False,
        ),
        sa.Column("email_alerts", sa.Boolean(), server_default="1", nullable=False),
        sa.Column("sms_alerts", sa.Boolean(), server_default="0", nullable=False),
        sa.Column("sns_subscription_arn", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_district"), "users", ["district"], unique=False)
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)

    # ------------------------------------------------------------------
    # alert_zones
    # ------------------------------------------------------------------
    op.create_table(
        "alert_zones",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("district", sa.String(length=100), nullable=False),
        sa.Column(
            "alert_level",
            sa.Enum("safe", "watch", "warning", "emergency", name="alert_level"),
            server_default="safe",
            nullable=False,
        ),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_alert_zones_alert_level"), "alert_zones", ["alert_level"], unique=False)
    op.create_index(op.f("ix_alert_zones_district"), "alert_zones", ["district"], unique=True)
    op.create_index(op.f("ix_alert_zones_id"), "alert_zones", ["id"], unique=False)

    # ------------------------------------------------------------------
    # flood_alerts
    # ------------------------------------------------------------------
    op.create_table(
        "flood_alerts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("zone_id", sa.Integer(), nullable=False),
        sa.Column("triggered_by", sa.Integer(), nullable=True),
        sa.Column(
            "alert_level",
            sa.Enum("safe", "watch", "warning", "emergency", name="flood_alert_level"),
            nullable=False,
        ),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("sns_message_id", sa.String(length=255), nullable=True),
        sa.Column(
            "triggered_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["triggered_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["zone_id"], ["alert_zones.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_flood_alerts_alert_level"), "flood_alerts", ["alert_level"], unique=False)
    op.create_index(op.f("ix_flood_alerts_id"), "flood_alerts", ["id"], unique=False)
    op.create_index(op.f("ix_flood_alerts_sns_message_id"), "flood_alerts", ["sns_message_id"], unique=False)
    op.create_index(op.f("ix_flood_alerts_triggered_at"), "flood_alerts", ["triggered_at"], unique=False)
    op.create_index(op.f("ix_flood_alerts_triggered_by"), "flood_alerts", ["triggered_by"], unique=False)
    op.create_index(op.f("ix_flood_alerts_zone_id"), "flood_alerts", ["zone_id"], unique=False)

    # ------------------------------------------------------------------
    # incident_reports
    # ------------------------------------------------------------------
    op.create_table(
        "incident_reports",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("district", sa.String(length=100), nullable=False),
        sa.Column("severity", sa.Integer(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("image_url", sa.String(length=1024), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("pending", "approved", "rejected", name="report_status"),
            server_default="pending",
            nullable=False,
        ),
        sa.Column("helpful_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("severity BETWEEN 1 AND 5", name="ck_incident_reports_severity_range"),
        sa.CheckConstraint("helpful_count >= 0", name="ck_incident_reports_helpful_count_nonnegative"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_incident_reports_created_at"), "incident_reports", ["created_at"], unique=False)
    op.create_index(op.f("ix_incident_reports_district"), "incident_reports", ["district"], unique=False)
    op.create_index(op.f("ix_incident_reports_id"), "incident_reports", ["id"], unique=False)
    op.create_index(op.f("ix_incident_reports_status"), "incident_reports", ["status"], unique=False)
    op.create_index(op.f("ix_incident_reports_user_id"), "incident_reports", ["user_id"], unique=False)

    # ------------------------------------------------------------------
    # sensor_stations
    # ------------------------------------------------------------------
    op.create_table(
        "sensor_stations",
        sa.Column("id", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("district", sa.String(length=100), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("warning_threshold", sa.Float(), nullable=False),
        sa.Column("danger_threshold", sa.Float(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="1", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "warning_threshold >= 0",
            name="ck_sensor_stations_warning_threshold_nonnegative",
        ),
        sa.CheckConstraint(
            "danger_threshold >= warning_threshold",
            name="ck_sensor_stations_danger_threshold_valid",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_sensor_stations_district"), "sensor_stations", ["district"], unique=False)


def downgrade() -> None:
    """Drop all tables in reverse dependency order."""
    op.drop_index(op.f("ix_sensor_stations_district"), table_name="sensor_stations")
    op.drop_table("sensor_stations")

    op.drop_index(op.f("ix_incident_reports_user_id"), table_name="incident_reports")
    op.drop_index(op.f("ix_incident_reports_status"), table_name="incident_reports")
    op.drop_index(op.f("ix_incident_reports_id"), table_name="incident_reports")
    op.drop_index(op.f("ix_incident_reports_district"), table_name="incident_reports")
    op.drop_index(op.f("ix_incident_reports_created_at"), table_name="incident_reports")
    op.drop_table("incident_reports")

    op.drop_index(op.f("ix_flood_alerts_zone_id"), table_name="flood_alerts")
    op.drop_index(op.f("ix_flood_alerts_triggered_by"), table_name="flood_alerts")
    op.drop_index(op.f("ix_flood_alerts_triggered_at"), table_name="flood_alerts")
    op.drop_index(op.f("ix_flood_alerts_sns_message_id"), table_name="flood_alerts")
    op.drop_index(op.f("ix_flood_alerts_id"), table_name="flood_alerts")
    op.drop_index(op.f("ix_flood_alerts_alert_level"), table_name="flood_alerts")
    op.drop_table("flood_alerts")

    op.drop_index(op.f("ix_alert_zones_id"), table_name="alert_zones")
    op.drop_index(op.f("ix_alert_zones_district"), table_name="alert_zones")
    op.drop_index(op.f("ix_alert_zones_alert_level"), table_name="alert_zones")
    op.drop_table("alert_zones")

    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_index(op.f("ix_users_district"), table_name="users")
    op.drop_table("users")

    # Drop custom Enum types (MySQL manages these inline, but explicit for
    # compatibility with other dialects such as PostgreSQL).
    sa.Enum(name="flood_alert_level").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="alert_level").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="report_status").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="user_role").drop(op.get_bind(), checkfirst=True)
