# OPS — Runbook

One source of truth for running, testing, and understanding deploys. Agent rules live in [/AGENTS.md](../AGENTS.md).

## Local setup

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then fill in real values (never commit .env)
```

Prerequisites: Python 3.10+, Node 18+, (optional) Docker.

## Running each service

| Service | Command | URL |
|---|---|---|
| Backend | `uvicorn main:app --reload` | http://localhost:8000 (docs at `/docs`) |
| Frontend | `cd frontend && npm install && npm start` | http://localhost:3000 |
| Terminal service | `cd terminal-service && npm install && node server.js` | ws://localhost:3001 |
| All-in-one | `docker-compose up --build` | — |

Dev test account: `test@test.com` / `test1234` (recreate with `python create_admin.py`).

## Tests

Almost everything needs a running stack. What exists:

- `tests/test_terminal_proxy.py` — the one **offline** test (FastAPI TestClient, no network, no running services): verifies the `ENABLE_TERMINAL` gate on `/ws/terminal`. Run it with `python -m pytest tests/test_terminal_proxy.py -q` (needs `pip install pytest` — see below).
- `tests/` (the rest) — pytest + Playwright E2E against a **running** localhost:3000 stack, plus a locustfile for load testing.
- `frontend/` — `npm test` (react-scripts, a few `__tests__`).

The E2E/load dependencies are **not in `requirements.txt`** (kept out deliberately — the deploy zip ships requirements.txt). Install ad hoc:

```bash
pip install pytest playwright locust && playwright install
```

Fast verification used instead of a suite:

```bash
python -c "import main"               # app + all 13 routers import
python -c "from core import config"  # path config sanity
cd frontend && npm run build          # only when frontend changed
```

### Manual smoke test — classroom description editing

Merged from the root `QUICKSTART.md` (original archived at `docs/_archives/QUICKSTART.md`). Needs backend + frontend running and a teacher login.

1. Teacher Dashboard → open an owned classroom; a description section shows below the class name/category badge ("No description yet…" when empty).
2. "✏️ Edit" → type a description → "✓ Save" → it displays; refresh the page → it persists.
3. Edit again and "✕ Cancel" → text reverts to the saved value.
4. DevTools Network check: saving sends `PATCH /classrooms/{id}` with body `{"description": "…"}` → 200.

Implementation: `frontend/src/classroomService.js` (`updateClassroom()`) + `frontend/src/TeacherClassroomDetail.js` (state + inline editor); backend PATCH endpoint pre-existed. Technical details: `docs/_archives/IMPLEMENTATION_SUMMARY.md`.

## Feature flags

- **`ENABLE_TERMINAL`** (env var, default **off**) — gates the backend `/ws/terminal` WebSocket proxy (`routers/terminal.py`; AUD-1 owner decision 2026-10-22 — the terminal-service it bridges to is unauthenticated and unsandboxed, audit SEC-1..6). When off, the WS handshake is rejected with HTTP 403 (close code 1008), so **the in-browser interactive Java terminal (Scanner/stdin) does not work in production**: the frontend prints `[WebSocket error — retrying via HTTP]` and falls back to batch execution via Paiza (no interactive input). Set `ENABLE_TERMINAL=true` (an app-setting change restarts the app) only after the terminal service is hardened. Details and frontend behavior: [docs/modules/code-playground.md](modules/code-playground.md).

## Vector store rebuild (document only — do not run casually)

`python rebuild_vectorstore.py` regenerates the FAISS stores in `vectorstore/` (java_knowledge, platform_guide). The binaries are **committed on purpose** for fast Azure startup — a rebuild changes tracked binaries and, if pushed, triggers a backend deploy (`vectorstore/` is in the CI path filter). Inspect metadata with `vectorstore/extract_from_faiss.py`; never hand-edit `index.faiss`.

## Deploy mechanics

Both GitHub Actions workflows deploy **on every push to `main`** matching their path filters:

- `backend.yml`: any `*.py`, `requirements.txt`, `startup.sh`, `routers/`, `services/`, `core/`, `vectorstore/`, `practical_tests/`, `terminal-service/` → zips the repo (minus `frontend/`) → synchronous `az webapp deploy` to App Service `codetutor-fyp-hei` → polls `/health` (the deploy is no longer `--async`, so the poll validates the **new** build).
- `frontend.yml`: `frontend/**` plus stale root filters `public/**`, `src/**`, `package.json` → CRA build → regenerates `server.js` at package time (the repo copy was deleted in bec2835) → deploys to the frontend App Service.

There is no staging environment. **Never push without the owner's explicit go-ahead.**

## Known failure patterns

- **`startup.sh` layout assumption** — on Azure it locates `main.py` by searching under `/tmp` at runtime (Oryx extraction + `antenv` venv dance). It assumes the current flat repo layout; moving backend files breaks startup.
- **Stale path defaults in `core/config.py`** — `PDF_DIR` defaults to `frontend/Lecture Notes-20250622` and `LESSON_DIR` to `lessons_raw`; **neither directory exists**. Both are env-overridable; code paths relying on the defaults fail quietly. (Backlog item.)
- **CRA env vars are build-time** — changing `REACT_APP_*` requires a rebuild/redeploy, not an app-settings change.
- **Terminal-service has no native binaries** — it uses plain `child_process` (there is no node-pty; the old `npm rebuild node-pty` Azure step is obsolete). Bind terminal-service to localhost only.
