"""Offline tests for the 2026-10-23 bug-audit Crit/High fix pass.

FastAPI TestClient only — no network, no running services, in-memory SQLite.
Run from backend/: python -m pytest tests/test_bug_audit_crit_high.py -q
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

os.environ.setdefault("SECRET_KEY", "offline-test-signing-key-not-a-secret")

from database import Base, get_db  # noqa: E402
from routers import auth  # noqa: E402
from routers import classroom as classroom_router  # noqa: E402
from routers import practical_tests  # noqa: E402
from db_models import (  # noqa: E402
    User, Classroom, ClassroomMember, ClassroomQuiz, ClassroomPracticalChallenge,
)
from core.rate_limiter import limiter  # noqa: E402
from slowapi import _rate_limit_exceeded_handler  # noqa: E402
from slowapi.errors import RateLimitExceeded  # noqa: E402


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    limiter.reset()
    yield


@pytest.fixture()
def classroom_app():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)

    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.include_router(auth.router)
    app.include_router(classroom_router.router)

    def _get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _get_db

    with TestClient(app) as c:
        yield c, TestSession


def _register(client, email, password="pw123456"):
    r = client.post("/auth/register", json={"email": email, "password": password})
    assert r.status_code == 200
    return r.json()


def _hdr(user):
    return {"Authorization": f"Bearer {user['access_token']}"}


QUESTIONS = [
    {"id": "q1", "question": "2+2?", "options": ["3", "4"], "correct_index": 1, "explanation": "basic math"},
    {"id": "q2", "question": "3+3?", "options": ["5", "6"], "correct_index": 1, "explanation": "basic math"},
]


def _make_classroom_with_quiz(TestSession):
    db = TestSession()
    teacher = User(email="teacher@example.com", password_hash="x", role="teacher")
    db.add(teacher)
    db.commit()
    room = Classroom(name="Room", class_code="JAVA101A", teacher_id=teacher.id)
    db.add(room)
    db.commit()
    quiz = ClassroomQuiz(
        classroom_id=room.id, title="Quiz", questions=QUESTIONS,
        status="published", created_by=teacher.id,
    )
    db.add(quiz)
    db.commit()
    ids = (room.id, quiz.id, teacher.id)
    db.close()
    return ids


# --- S13: quiz score graded server-side from correct_index, not trusted ------

def test_quiz_submit_ignores_client_score_and_grades_from_correct_index(classroom_app):
    c, TestSession = classroom_app
    room_id, quiz_id, _ = _make_classroom_with_quiz(TestSession)

    student = _register(c, "s1@example.com")
    db = TestSession()
    db.add(ClassroomMember(classroom_id=room_id, student_id=student["user_id"]))
    db.commit()
    db.close()

    # Client claims 100 but only answers q1 correctly (1/2 = 50%).
    r = c.post(
        f"/classrooms/{room_id}/quizzes/{quiz_id}/submit",
        headers=_hdr(student),
        json={"score": 100, "answers": {"q1": 1, "q2": 0}},
    )
    assert r.status_code == 200
    assert r.json()["score"] == 50.0


def test_quiz_submit_all_correct_scores_100(classroom_app):
    c, TestSession = classroom_app
    room_id, quiz_id, _ = _make_classroom_with_quiz(TestSession)

    student = _register(c, "s2@example.com")
    db = TestSession()
    db.add(ClassroomMember(classroom_id=room_id, student_id=student["user_id"]))
    db.commit()
    db.close()

    r = c.post(
        f"/classrooms/{room_id}/quizzes/{quiz_id}/submit",
        headers=_hdr(student),
        json={"score": 0, "answers": {"q1": 1, "q2": 1}},
    )
    assert r.status_code == 200
    assert r.json()["score"] == 100.0


def test_quiz_submit_missing_answers_scores_zero_not_crash(classroom_app):
    c, TestSession = classroom_app
    room_id, quiz_id, _ = _make_classroom_with_quiz(TestSession)

    student = _register(c, "s3@example.com")
    db = TestSession()
    db.add(ClassroomMember(classroom_id=room_id, student_id=student["user_id"]))
    db.commit()
    db.close()

    r = c.post(
        f"/classrooms/{room_id}/quizzes/{quiz_id}/submit",
        headers=_hdr(student),
        json={"score": 99},
    )
    assert r.status_code == 200
    assert r.json()["score"] == 0.0


# --- S14: published quiz list/get strips the answer key for students --------

def test_student_quiz_responses_omit_answer_key(classroom_app):
    c, TestSession = classroom_app
    room_id, quiz_id, _ = _make_classroom_with_quiz(TestSession)

    student = _register(c, "s4@example.com")
    db = TestSession()
    db.add(ClassroomMember(classroom_id=room_id, student_id=student["user_id"]))
    db.commit()
    db.close()

    r = c.get(f"/classrooms/{room_id}/quizzes/{quiz_id}", headers=_hdr(student))
    assert r.status_code == 200
    for q in r.json()["questions"]:
        assert "correct_index" not in q
        assert "explanation" not in q

    r = c.get(f"/classrooms/{room_id}/quizzes", headers=_hdr(student))
    assert r.status_code == 200
    for quiz in r.json():
        for q in quiz["questions"]:
            assert "correct_index" not in q
            assert "explanation" not in q


# --- S11: PATCH classroom must reject students, not silently allow them -----

def test_patch_classroom_rejects_non_owner_student(classroom_app):
    c, TestSession = classroom_app
    room_id, _, _ = _make_classroom_with_quiz(TestSession)

    student = _register(c, "s5@example.com")
    r = c.patch(f"/classrooms/{room_id}", headers=_hdr(student), json={"name": "Hacked"})
    assert r.status_code == 403


# --- S9: teacher ownership check on student-results --------------------------

def test_quiz_student_results_rejects_non_owner_teacher(classroom_app):
    c, TestSession = classroom_app
    room_id, quiz_id, _ = _make_classroom_with_quiz(TestSession)

    other_teacher = _register(c, "other-teacher@example.com")
    db = TestSession()
    u = db.query(User).filter(User.id == other_teacher["user_id"]).first()
    u.role = "teacher"
    db.commit()
    db.close()

    r = c.get(f"/classrooms/{room_id}/quizzes/{quiz_id}/student-results", headers=_hdr(other_teacher))
    assert r.status_code == 403


# --- S13 (challenge half): submit is graded by re-executing the code --------
# server-side, never by trusting the client's claimed execution_output/passed.

def _make_classroom_with_challenge(TestSession):
    db = TestSession()
    teacher = User(email="ch-teacher@example.com", password_hash="x", role="teacher")
    db.add(teacher)
    db.commit()
    room = Classroom(name="Room", class_code="JAVA101B", teacher_id=teacher.id)
    db.add(room)
    db.commit()
    challenge = ClassroomPracticalChallenge(
        classroom_id=room.id,
        title="Add two numbers",
        question={"title": "Add", "description": "Return 42", "methods": [], "expectedOutput": ["42"]},
        base_code={"class": "Main", "helperClasses": "", "methods": {"addNumbers": "public int addNumbers() {}"}},
        model_solution={"class": "Main", "helperClasses": "", "methods": {"addNumbers": ["return 42;"]}},
        status="published",
        created_by=teacher.id,
    )
    db.add(challenge)
    db.commit()
    ids = (room.id, challenge.id)
    db.close()
    return ids


def _enroll(TestSession, room_id, user_id):
    db = TestSession()
    db.add(ClassroomMember(classroom_id=room_id, student_id=user_id))
    db.commit()
    db.close()


STUDENT_CODE = {
    "Main": "public class Main {\n    public int addNumbers() {\n        return 42;\n    }\n}"
}


def test_challenge_submit_ignores_forged_passed_claim(classroom_app, monkeypatch):
    """A client claiming passed=True with no real execution must not be
    believed — the server re-runs the code itself."""
    c, TestSession = classroom_app
    room_id, challenge_id = _make_classroom_with_challenge(TestSession)
    student = _register(c, "ch-s1@example.com")
    _enroll(TestSession, room_id, student["user_id"])

    def fake_run(class_name, class_body, run_app_method, helper_classes="", stdin=None):
        # Simulate the student's actual code printing the WRONG output,
        # even though the forged client payload below claims success.
        return {"success": True, "output": "0", "error": ""}

    monkeypatch.setattr(practical_tests, "_run_java_via_paiza", fake_run)

    r = c.post(
        f"/classrooms/{room_id}/practical-challenges/{challenge_id}/submit",
        headers=_hdr(student),
        json={
            "submitted_code": STUDENT_CODE,
            "execution_output": {"passed": True, "success": True, "status": "completed"},
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["passed"] is False
    assert body["execution_output"]["stdout"] == "0"
    assert body["execution_output"]["expected_output"] == ["42"]


def test_challenge_submit_passes_when_real_output_matches(classroom_app, monkeypatch):
    c, TestSession = classroom_app
    room_id, challenge_id = _make_classroom_with_challenge(TestSession)
    student = _register(c, "ch-s2@example.com")
    _enroll(TestSession, room_id, student["user_id"])

    def fake_run(class_name, class_body, run_app_method, helper_classes="", stdin=None):
        return {"success": True, "output": "42", "error": ""}

    monkeypatch.setattr(practical_tests, "_run_java_via_paiza", fake_run)

    r = c.post(
        f"/classrooms/{room_id}/practical-challenges/{challenge_id}/submit",
        headers=_hdr(student),
        json={"submitted_code": STUDENT_CODE, "execution_output": {"passed": False}},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["passed"] is True
