"""rename image_url to image_key

Revision ID: a1b2c3d4e5f6
Revises: d7de28595da6
Create Date: 2026-08-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str = "d7de28595da6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "incident_reports",
        "image_url",
        new_column_name="image_key",
        existing_type=sa.String(length=1024),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "incident_reports",
        "image_key",
        new_column_name="image_url",
        existing_type=sa.String(length=1024),
        existing_nullable=True,
    )
