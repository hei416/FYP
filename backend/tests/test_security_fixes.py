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


# --- SEC-10: classroom file view/download require enrollment -----------------

@pytest.fixture()
def classroom_client():
    """App with auth + classroom routers, one classroom with one file."""
    from db_models import Classroom, ClassroomFile
    from routers import classroom as classroom_router

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)

    app = FastAPI()
    app.include_router(auth.router)
    app.include_router(classroom_router.router)

    def _get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _get_db

    db = TestSession()
    from db_models import User
    teacher = User(email="t0@example.com", password_hash="x", role="teacher")
    db.add(teacher)
    db.commit()
    room = Classroom(name="Room", class_code="JAVA101A", teacher_id=teacher.id)
    db.add(room)
    db.commit()
    f = ClassroomFile(
        classroom_id=room.id, filename="notes.txt",
        mime_type="text/plain", file_data=b"hello",
    )
    db.add(f)
    db.commit()
    ids = (room.id, f.id)
    db.close()

    with TestClient(app) as c:
        yield c, ids, TestSession


def _register(client, email):
    r = client.post("/auth/register", json={"email": email, "password": "pw123456"})
    assert r.status_code == 200
    return r.json()


def test_file_endpoints_require_enrollment(classroom_client):
    from db_models import ClassroomMember
    c, (room_id, file_id), TestSession = classroom_client
    user = _register(c, "s1@example.com")
    hdr = {"Authorization": f"Bearer {user['access_token']}"}

    # not enrolled -> 403 on both endpoints (view takes ?token= too)
    assert c.get(f"/classrooms/{room_id}/files/{file_id}/download", headers=hdr).status_code == 403
    assert c.get(f"/classrooms/{room_id}/files/{file_id}/view", headers=hdr).status_code == 403
    assert c.get(
        f"/classrooms/{room_id}/files/{file_id}/view",
        params={"token": user["access_token"]},
    ).status_code == 403

    # unauthenticated -> 401
    assert c.get(f"/classrooms/{room_id}/files/{file_id}/view").status_code == 401

    # enrolled -> 200
    db = TestSession()
    db.add(ClassroomMember(classroom_id=room_id, student_id=user["user_id"]))
    db.commit()
    db.close()
    assert c.get(f"/classrooms/{room_id}/files/{file_id}/download", headers=hdr).status_code == 200
    assert c.get(f"/classrooms/{room_id}/files/{file_id}/view", headers=hdr).status_code == 200


# --- SEC-11: conversation history/stats/create/clear/list require auth -------

@pytest.fixture()
def rag_client():
    from routers import rag as rag_router

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)

    app = FastAPI()
    app.include_router(auth.router)
    app.include_router(rag_router.router)

    def _get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _get_db
    with TestClient(app) as c:
        yield c


def test_conversation_endpoints_require_auth(rag_client):
    c = rag_client
    assert c.post("/api/conversations/history", json={"user_id": 1}).status_code == 401
    assert c.post("/api/conversations/stats", json={"user_id": 1}).status_code == 401
    assert c.post("/api/conversations/create", json={"user_id": 1}).status_code == 401
    assert c.post("/api/conversations/clear", json={"user_id": 1}).status_code == 401
    assert c.get("/api/conversations/1/list").status_code == 401


def test_conversation_endpoints_reject_other_users(rag_client):
    c = rag_client
    user = _register(c, "conv@example.com")
    hdr = {"Authorization": f"Bearer {user['access_token']}"}
    other = user["user_id"] + 999
    assert c.post("/api/conversations/history", json={"user_id": other, "conversation_id": "x"}, headers=hdr).status_code == 403
    assert c.post("/api/conversations/stats", json={"user_id": other}, headers=hdr).status_code == 403
    assert c.post("/api/conversations/create", json={"user_id": other}, headers=hdr).status_code == 403
    assert c.post("/api/conversations/clear", json={"user_id": other}, headers=hdr).status_code == 403
    assert c.get(f"/api/conversations/{other}/list", headers=hdr).status_code == 403


# --- SEC-9: unhandled exceptions must not leak tracebacks to clients ---------

def test_unhandled_exception_returns_generic_500():
    import main
    from core import config as cfg
    assert cfg.DEBUG_MODE is False  # test env must not run in debug

    boom_path = "/_test_boom_sec9"
    if not any(getattr(r, "path", None) == boom_path for r in main.app.routes):
        async def _boom():
            raise RuntimeError("sensitive internal detail")
        main.app.add_api_route(boom_path, _boom, methods=["GET"])

    c = TestClient(main.app, raise_server_exceptions=False)
    r = c.get(boom_path)
    assert r.status_code == 500
    body = r.json()
    assert body == {"detail": "Internal server error"}
    assert "sensitive internal detail" not in r.text
    assert "Traceback" not in r.text
