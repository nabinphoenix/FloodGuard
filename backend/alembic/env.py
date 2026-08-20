"""Alembic environment configuration for FloodGuard.

Customisations over the generated default:
- Adds the ``backend/`` directory to ``sys.path`` so that the project
  modules (config, database, models) are importable when Alembic runs
  from *any* working directory.
- Reads ``DATABASE_URL`` from the project's pydantic-settings object
  (``config.settings``) instead of a hard-coded ini value.
- Imports all four SQLAlchemy model modules so that ``--autogenerate``
  can detect every table in ``Base.metadata``.
"""

from __future__ import annotations

import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config, pool

from alembic import context

# ---------------------------------------------------------------------------
# Ensure the ``backend/`` package root is on sys.path so that our project
# imports (config, database, models.*) resolve correctly regardless of the
# directory Alembic is invoked from.
# ---------------------------------------------------------------------------
BACKEND_DIR = Path(__file__).resolve().parent.parent  # …/backend/
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# ---------------------------------------------------------------------------
# Load project settings and Base *after* sys.path is fixed.
# ---------------------------------------------------------------------------
from config import settings  # noqa: E402
from database import Base  # noqa: E402

# Import every model module so their Table definitions register with Base.metadata.
# Add new model modules here as they are created.
import models.alert   # noqa: F401, E402
import models.report  # noqa: F401, E402
import models.sensor  # noqa: F401, E402
import models.user    # noqa: F401, E402

# ---------------------------------------------------------------------------
# Alembic Config & logging
# ---------------------------------------------------------------------------
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Point autogenerate at our fully-populated metadata.
target_metadata = Base.metadata


# ---------------------------------------------------------------------------
# Helper: resolve the database URL from project settings at runtime so that
# no connection string is ever stored in alembic.ini.
# ---------------------------------------------------------------------------
def _get_url() -> str:
    return settings.database_url


# ---------------------------------------------------------------------------
# Offline mode — emits SQL to stdout without a live DB connection.
# ---------------------------------------------------------------------------
def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    Configures the context with just a URL, not an Engine.  Useful for
    generating plain-SQL migration scripts.
    """
    context.configure(
        url=_get_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        # Compare server defaults so autogenerate catches them.
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


# ---------------------------------------------------------------------------
# Online mode — connects to the real database and runs migrations directly.
# ---------------------------------------------------------------------------
def run_migrations_online() -> None:
    """Run migrations in 'online' mode (default)."""
    # Override sqlalchemy.url in the ini section with the runtime value so
    # engine_from_config picks it up without touching alembic.ini.
    cfg_section = config.get_section(config.config_ini_section, {})
    cfg_section["sqlalchemy.url"] = _get_url()

    connectable = engine_from_config(
        cfg_section,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            # Compare server defaults so autogenerate catches them.
            compare_server_default=True,
        )

        with context.begin_transaction():
            context.run_migrations()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
