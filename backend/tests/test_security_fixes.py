"""Offline tests for the pre-first-deploy security batch (AUD-3).

FastAPI TestClient only — no network, no running services, in-memory SQLite.
Run from backend/: python -m pytest tests/test_security_fixes.py -q
"""
import os
import sys

import pytest
from fastapi import FastAPI
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from starlette.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Offline-only signing key; must be set before the auth module is imported.
os.environ.setdefault("SECRET_KEY", "offline-test-signing-key-not-a-secret")

from database import Base, get_db  # noqa: E402
from routers import auth  # noqa: E402


@pytest.fixture()
def client():
    """App with just the auth router and an isolated in-memory DB."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)

    app = FastAPI()
    app.include_router(auth.router)

    def _get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _get_db
    with TestClient(app) as c:
        yield c


# --- SEC-7: self-registration must not grant elevated roles -----------------

def test_register_defaults_to_student(client):
    r = client.post("/auth/register", json={
        "email": "a@example.com", "password": "pw123456", "full_name": "A",
    })
    assert r.status_code == 200
    assert r.json()["role"] == "student"


def test_register_as_teacher_rejected(client):
    r = client.post("/auth/register", json={
        "email": "t@example.com", "password": "pw123456", "role": "teacher",
    })
    assert r.status_code == 403


def test_register_as_admin_rejected(client):
    r = client.post("/auth/register", json={
        "email": "adm@example.com", "password": "pw123456", "role": "admin",
    })
    assert r.status_code == 403


# --- SEC-8: CORS must be an explicit allowlist, never wildcard ---------------

def test_cors_origins_default_is_localhost_allowlist():
    from core import config
    assert "*" not in config.CORS_ORIGINS
    assert "http://localhost:3000" in config.CORS_ORIGINS


def test_cors_origins_env_override(monkeypatch):
    import importlib
    from core import config
    monkeypatch.setenv("CORS_ORIGINS", "https://example.edu, https://app.example.edu")
    importlib.reload(config)
    try:
        assert config.CORS_ORIGINS == ["https://example.edu", "https://app.example.edu"]
    finally:
        monkeypatch.undo()
        importlib.reload(config)
