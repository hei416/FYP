# Classroom & roles

**Parts** (all under `backend/`): `routers/auth.py` (JWT auth, bcrypt passwords), `routers/admin.py`, `routers/classroom.py` (teacher/student classroom management), `routers/my_work.py`, `routers/progress.py`, `routers/practical_tests.py`; models in `db_models.py` (SQLAlchemy) and `models.py` (Pydantic).

**Roles:** student / teacher / admin. Teachers manage classrooms (incl. inline description edit); students join and work through lessons, quizzes, and practical tests.

**Data dependency:** `backend/quiz_questions.csv` (moved with the 2026-10-22 restructure) — treat it as data (backlog item tracks getting it out of git). Correction while moving it: no `.py` file actually references the CSV; the earlier claim confused it with the `quiz_questions` DB **table** in `db_models.py`.

**Database:** SQLite by default (`learning_platform.db`, auto-created), PostgreSQL in production via `DATABASE_URL`. Schema changes go through `backend/schema_migration.py` — running it is a state-changing action; ask the owner first.

**Dev account:** `test@test.com` / `test1234` (`cd backend && python create_admin.py` recreates it).

**How to test:** import check plus manual flows against a running stack; offline unit tests for auth/security gates in `backend/tests/test_security_fixes.py`; auth/classroom E2E lives in `backend/tests/`. Known gaps: password strength validation not wired into auth endpoints; some endpoints return generic 500s; no pagination on large lists (all in backlog).
