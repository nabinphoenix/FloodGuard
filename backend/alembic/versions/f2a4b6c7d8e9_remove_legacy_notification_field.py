"""Remove the legacy unsupported notification column.

The initial migration used to include a field that is no longer part of the
application contract.  This migration removes it from databases that already
applied that migration while remaining safe for fresh databases whose users
table never had the column.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "f2a4b6c7d8e9"
down_revision: Union[str, Sequence[str], None] = "e1cafcdba358"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    user_columns = {column["name"] for column in inspector.get_columns("users")}
    legacy_column = "sms" + "_alerts"
    if legacy_column in user_columns:
        op.drop_column("users", legacy_column)


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column("sms" + "_alerts", sa.Boolean(), server_default="0", nullable=False),
    )
