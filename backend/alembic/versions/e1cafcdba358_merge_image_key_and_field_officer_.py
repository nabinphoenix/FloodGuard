"""merge image key and field officer branches

Revision ID: e1cafcdba358
Revises: a1b2c3d4e5f6, ab0fcd415199
Create Date: 2026-08-20 18:15:40.865385

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1cafcdba358'
down_revision: Union[str, Sequence[str], None] = ('a1b2c3d4e5f6', 'ab0fcd415199')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
