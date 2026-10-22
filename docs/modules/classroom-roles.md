# Classroom & roles

**Parts:** `routers/auth.py` (JWT auth, bcrypt passwords), `routers/admin.py`, `routers/classroom.py` (teacher/student classroom management), `routers/my_work.py`, `routers/progress.py`, `routers/practical_tests.py`; models in `db_models.py` (SQLAlchemy) and `models.py` (Pydantic).

**Roles:** student / teacher / admin. Teachers manage classrooms (incl. inline description edit); students join and work through lessons, quizzes, and practical tests.

**Data dependency:** `quiz_questions.csv` at the repo root is referenced by `db_models.py` and `routers/classroom.py` — treat it as data, do not move or delete it (backlog item tracks getting it out of git).

**Database:** SQLite by default (`learning_platform.db`, auto-created), PostgreSQL in production via `DATABASE_URL`. Schema changes go through `schema_migration.py` — running it is a state-changing action; ask the owner first.

**Dev account:** `test@test.com` / `test1234` (`python create_admin.py` recreates it).

**How to test:** import check plus manual flows against a running stack; auth/classroom E2E lives in `tests/`. Known gaps: password strength validation not wired into auth endpoints; some endpoints return generic 500s; no pagination on large lists (all in backlog).
