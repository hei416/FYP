# Backend routers

12 routers in `backend/routers/`, registered in a static list in `backend/main.py` (~line 550): admin, auth, classroom, code_execution, conversation, lessons, my_work, pdfs, practical_tests, progress, rag, terminal — plus `__init__.py`.

**Pattern:** API handlers in `backend/routers/`, business logic in `backend/services/` (classroom_rag, conversation_manager, error_explainer, nli_monitor, rag_helpers). Keep new logic in a service, not the router.

**Config:** everything path-related comes from `backend/core/config.py` (`PROJECT_ROOT`-derived — resolves to `backend/` — env-overridable). External integrations (Paiza, LLM API) read env vars there.

**Rate limits (slowapi):** `/ragAI` 30 req/min, `/api/run-code` and `/api/explain-error` 20 req/min, `/auth/login` and `/auth/register` 5 req/min (SEC-14; keyed by client IP — behind a proxy that's the proxy IP until SEC-15). Registration enforces a password policy (SEC-16: 8–72 bytes, letter + digit).

**How to use:** run the backend (`cd backend && uvicorn main:app --reload`) and browse http://localhost:8000/docs for the live OpenAPI surface.

**How to test:** `python -c "import main"` (from `backend/`) confirms the app and all routers import. Offline unit tests + full E2E live in `backend/tests/` (E2E needs a running stack) — see [../OPS.md](../OPS.md). Adding a router: create it in `backend/routers/`, register it in the static list in `backend/main.py`, re-run the import check. Any `backend/**` change deploys the backend when pushed.
