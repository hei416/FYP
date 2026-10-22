# backend/routers/ — API handlers

12 FastAPI routers (admin, auth, classroom, code_execution, conversation, lessons, my_work, pdfs, practical_tests, progress, rag, terminal), registered in the **static list in `backend/main.py` (~line 550)**. Full guide: [docs/modules/backend-routers.md](../../docs/modules/backend-routers.md).

## Rules

- Keep handlers thin: business logic belongs in [`../services/`](../services/AGENTS.md), not here.
- Rate limits come from slowapi (`core/rate_limiter.py`): `/ragAI` 30/min, `/api/run-code` and `/api/explain-error` 20/min, `/auth/login` and `/auth/register` 5/min. Don't remove them (SEC-14).
- `terminal.py` is gated behind `ENABLE_TERMINAL` (default **off**, owner decision AUD-1) — rejects the WebSocket with 403 before proxying. Don't re-enable without the SEC-2/3/5/6 hardening.
- Adding a router: create it here, register it in the static list in `main.py`, re-run the import check.

## Verify

From `backend/`: `python -c "import main"` — confirms the app and all routers import. Live surface: run the backend and browse http://localhost:8000/docs.
