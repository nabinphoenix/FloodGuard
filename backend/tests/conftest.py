import os
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-only-secret")
os.environ.setdefault("AWS_REGION", "us-east-1")
os.environ.setdefault("S3_BUCKET_NAME", "test-bucket")
os.environ.setdefault("SNS_TOPIC_ARN", "arn:aws:sns:us-east-1:123456789012:test-topic")
os.environ.setdefault("SQS_SENSOR_QUEUE_URL", "https://sqs.us-east-1.amazonaws.com/123456789012/test-queue")
os.environ.setdefault("BROADCAST_API_URL", "http://localhost")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")
os.environ.setdefault("AWS_EC2_METADATA_DISABLED", "true")

from database import Base  # noqa: E402
from models import alert, report, sensor, user  # noqa: E402, F401


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    Base.metadata.drop_all(engine)


@pytest.fixture
def client(db):
    from fastapi.testclient import TestClient

    from database import get_db
    from main import app
    from routers.auth import get_current_user

    current_user = {"value": None}

    def override_db():
        yield db

    def override_current_user():
        return current_user["value"]

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = override_current_user
    with TestClient(app) as test_client:
        yield test_client, current_user
    app.dependency_overrides.clear()
