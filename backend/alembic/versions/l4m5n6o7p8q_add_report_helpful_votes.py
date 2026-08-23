"""add per-user report helpful votes

Revision ID: l4m5n6o7p8q
Revises: k3l4m5n6o7p
Create Date: 2026-08-23
"""

from alembic import op
import sqlalchemy as sa


revision = "l4m5n6o7p8q"
down_revision = "k3l4m5n6o7p"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "report_helpful_votes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("report_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["report_id"], ["incident_reports.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("report_id", "user_id", name="uq_report_helpful_votes_report_user"),
    )
    op.create_index(op.f("ix_report_helpful_votes_id"), "report_helpful_votes", ["id"], unique=False)
    op.create_index(op.f("ix_report_helpful_votes_report_id"), "report_helpful_votes", ["report_id"], unique=False)
    op.create_index(op.f("ix_report_helpful_votes_user_id"), "report_helpful_votes", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_report_helpful_votes_user_id"), table_name="report_helpful_votes")
    op.drop_index(op.f("ix_report_helpful_votes_report_id"), table_name="report_helpful_votes")
    op.drop_index(op.f("ix_report_helpful_votes_id"), table_name="report_helpful_votes")
    op.drop_table("report_helpful_votes")
