"""Add field_officer role

Revision ID: ab0fcd415199
Revises: d7de28595da6
Create Date: 2026-08-20 09:51:47.572826

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ab0fcd415199'
down_revision: Union[str, Sequence[str], None] = 'd7de28595da6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TABLE users MODIFY COLUMN role ENUM('public', 'admin', 'authority', 'field_officer') NOT NULL DEFAULT 'public'")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("UPDATE users SET role = 'public' WHERE role = 'field_officer'")
    op.execute("ALTER TABLE users MODIFY COLUMN role ENUM('public', 'admin', 'authority') NOT NULL DEFAULT 'public'")
