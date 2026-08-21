from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from config import settings


class Base(DeclarativeBase):
    pass


engine_options = {
    "pool_pre_ping": True,
    "pool_recycle": 280,
}
if not settings.database_url.startswith("sqlite"):
    engine_options.update({"pool_size": 5, "max_overflow": 10})

engine = create_engine(settings.database_url, **engine_options)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    class_=Session,
)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
