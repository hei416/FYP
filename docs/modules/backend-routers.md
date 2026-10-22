# Backend routers

13 routers in `routers/`, registered in a static list in `main.py` (~line 505): admin, auth, classroom, code_execution, conversation, lessons, my_work, pdfs, practical_tests, progress, rag, terminal — plus `__init__.py`.

**Pattern:** API handlers in `routers/`, business logic in `services/` (classroom_rag, conversation_manager, error_explainer, nli_monitor, rag_helpers). Keep new logic in a service, not the router.

**Config:** everything path-related comes from `core/config.py` (`PROJECT_ROOT`-derived, env-overridable). External integrations (Paiza, LLM API) read env vars there.

**Rate limits (slowapi):** `/ragAI` 30 req/min, `/api/run-code` 20 req/min.

**How to use:** run the backend (`uvicorn main:app --reload`) and browse http://localhost:8000/docs for the live OpenAPI surface.

**How to test:** `python -c "import main"` confirms the app and all routers import. Full E2E lives in `tests/` and needs a running stack — see [../OPS.md](../OPS.md). Adding a router: create it in `routers/`, register it in the static list in `main.py`, re-run the import check. Any `.py` change deploys the backend when pushed.
