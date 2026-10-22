# OPS — Runbook

One source of truth for running, testing, and understanding deploys. Agent rules live in [/AGENTS.md](../AGENTS.md).

## Local setup

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
pip install -r backend/requirements-dev.txt   # dev/test tools (pytest)
cp .env.example .env        # then fill in real values (never commit .env)
```

The Python backend lives in `backend/` (restructured 2026-10-22); backend commands below run from that directory.

Prerequisites: Python 3.10+, Node 18+, (optional) Docker.

## Running each service

| Service | Command | URL |
|---|---|---|
| Backend | `cd backend && uvicorn main:app --reload` | http://localhost:8000 (docs at `/docs`) |
| Frontend | `cd frontend && npm install && npm start` | http://localhost:3000 |
| Terminal service | `cd terminal-service && npm install && node server.js` | ws://localhost:3001 |
| All-in-one | `docker-compose up --build` | — |

Dev test account: `test@test.com` / `test1234` (recreate with `cd backend && python create_admin.py`).

## Tests

Offline unit tests live in `backend/tests/`; E2E still needs a running stack. What exists:

- **Offline suite** (FastAPI TestClient, no network, no running services) — run from `backend/`: `python -m pytest tests/ -q --ignore=tests/test_acceptance.py --ignore=tests/test_browser_compat.py --ignore=tests/locustfile.py`. Covers the `ENABLE_TERMINAL` gate (`test_terminal_proxy.py`) and the pre-first-deploy security fixes (`test_security_fixes.py`: registration role forcing, CORS config, traceback suppression, auth on conversations//explain-error/files, SSRF guard). Dependencies: `pip install -r backend/requirements-dev.txt`.
- `backend/tests/` (the rest) — pytest + Playwright E2E against a **running** localhost:3000 stack, plus a locustfile for load testing.
- `frontend/` — `npm test` (react-scripts, a few `__tests__`).

Dev/test dependencies live in **`backend/requirements-dev.txt`** (pytest); the heavier E2E/load deps are still ad hoc (kept out deliberately — the deploy zip ships requirements.txt):

```bash
pip install playwright locust && playwright install
```

Fast verification used instead of a suite (run from `backend/`):

```bash
python -c "import main"               # app + all 13 routers import
python -c "from core import config"  # path config sanity
cd frontend && npm run build          # only when frontend changed (from the repo root)
```

### Manual smoke test — classroom description editing

Merged from the root `QUICKSTART.md` (original archived at `docs/_archives/QUICKSTART.md`). Needs backend + frontend running and a teacher login.

1. Teacher Dashboard → open an owned classroom; a description section shows below the class name/category badge ("No description yet…" when empty).
2. "✏️ Edit" → type a description → "✓ Save" → it displays; refresh the page → it persists.
3. Edit again and "✕ Cancel" → text reverts to the saved value.
4. DevTools Network check: saving sends `PATCH /classrooms/{id}` with body `{"description": "…"}` → 200.

Implementation: `frontend/src/classroomService.js` (`updateClassroom()`) + `frontend/src/TeacherClassroomDetail.js` (state + inline editor); backend PATCH endpoint pre-existed. Technical details: `docs/_archives/IMPLEMENTATION_SUMMARY.md`.

## Feature flags

- **`ENABLE_TERMINAL`** (env var, default **off**) — gates the backend `/ws/terminal` WebSocket proxy (`routers/terminal.py`; AUD-1 owner decision 2026-10-22 — the terminal-service it bridges to is unauthenticated and unsandboxed, audit SEC-1..6). When off, the WS handshake is rejected with HTTP 403 (close code 1008), so **the in-browser interactive Java terminal (Scanner/stdin) does not work in a deployed instance** (none is believed live — owner statement 2026-10-22): the frontend prints `[WebSocket error — retrying via HTTP]` and falls back to batch execution via Paiza (no interactive input). Set `ENABLE_TERMINAL=true` (an app-setting change restarts the app) only after the terminal service is hardened. Details and frontend behavior: [docs/modules/code-playground.md](modules/code-playground.md).

## Vector store rebuild (document only — do not run casually)

`cd backend && python rebuild_vectorstore.py` regenerates the FAISS stores in `backend/vectorstore/` (java_knowledge, platform_guide). The binaries are **committed on purpose** for fast Azure startup — a rebuild changes tracked binaries and, if pushed, triggers a backend deploy (`backend/**` is in the CI path filter). Inspect metadata with `backend/vectorstore/extract_from_faiss.py`; never hand-edit `index.faiss`.

## Deploy mechanics (latent)

**Owner statement 2026-10-22: the app has never been live in production.** CI history shows real deploy runs to the two App Services in Mar–Apr 2026 and none since 2026-04-22; whether the Azure resources and secrets still exist is unverifiable from the repo — evidence: [reports/deployment-evidence-2026-10-22.md](reports/deployment-evidence-2026-10-22.md). Treat the pipelines below as **latent but possibly armed**: a push to `main` matching the path filters may still start a real deploy. Before any first public deployment, work through [plans/active/first-deploy-readiness.md](plans/active/first-deploy-readiness.md).

Both GitHub Actions workflows fire **on every push to `main`** matching their path filters:

- `backend.yml`: `backend/**`, `startup.sh`, `terminal-service/**` (filters provisionally adjusted 2026-10-22 for the `backend/` restructure; final shape waits on the deploy-method decision) → zips the repo (minus `frontend/`) → synchronous `az webapp deploy` to App Service `codetutor-fyp-hei` → polls `/health` (the deploy is no longer `--async`, so the poll validates the **new** build).
- `frontend.yml`: `frontend/**` plus stale root filters `public/**`, `src/**`, `package.json` → CRA build → regenerates `server.js` at package time (the repo copy was deleted in bec2835) → deploys to the frontend App Service.

There is no staging environment. **Never push without the owner's explicit go-ahead.** Open question for the owner: no workflow run has fired since 2026-04-22 despite filter-matching pushes (Actions shows "active"; cause unverifiable with current token permissions) — resolve before relying on CI at all.

## Known failure patterns

- **`startup.sh` layout assumption** — on Azure it locates `main.py` by searching under `/tmp` at runtime (Oryx extraction + `antenv` venv dance). Updated 2026-10-22 for the `backend/` layout (the find resolves to `backend/`, wwwroot fallback is `/home/site/wwwroot/backend`, terminal-service launches from the repo dir above). **Unverified on Azure** — nothing is deployed; verify at first deploy.
- **Stale path defaults in `backend/core/config.py`** — `PDF_DIR` defaults to `frontend/Lecture Notes-20250622` (now doubly wrong: `PROJECT_ROOT` is `backend/`, which contains no `frontend/`) and `LESSON_DIR` to `lessons_raw`; **neither directory exists**. Both are env-overridable; code paths relying on the defaults fail quietly. (Backlog item BE-16.)
- **CRA env vars are build-time** — changing `REACT_APP_*` requires a rebuild/redeploy, not an app-settings change.
- **Terminal-service has no native binaries** — it uses plain `child_process` (there is no node-pty; the old `npm rebuild node-pty` Azure step is obsolete). Bind terminal-service to localhost only.
