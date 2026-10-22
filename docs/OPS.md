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

There is **no fast offline suite**. What exists:

- `tests/` — pytest + Playwright E2E against a **running** localhost:3000 stack, plus a locustfile for load testing.
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

## Vector store rebuild (document only — do not run casually)

`python rebuild_vectorstore.py` regenerates the FAISS stores in `vectorstore/` (java_knowledge, platform_guide). The binaries are **committed on purpose** for fast Azure startup — a rebuild changes tracked binaries and, if pushed, triggers a backend deploy (`vectorstore/` is in the CI path filter). Inspect metadata with `vectorstore/extract_from_faiss.py`; never hand-edit `index.faiss`.

## Deploy mechanics

Both GitHub Actions workflows deploy **on every push to `main`** matching their path filters:

- `backend.yml`: any `*.py`, `requirements.txt`, `startup.sh`, `routers/`, `services/`, `core/`, `vectorstore/`, `practical_tests/` → zips the repo (minus `frontend/`) → `az webapp deploy` to App Service `codetutor-fyp-hei` → polls a health endpoint.
- `frontend.yml`: `frontend/**` plus stale root filters `public/**`, `src/**`, `package.json` → CRA build → deploys to the frontend App Service.

There is no staging environment. **Never push without the owner's explicit go-ahead.**

## Known failure patterns

- **`startup.sh` layout assumption** — on Azure it locates `main.py` by searching under `/tmp` at runtime (Oryx extraction + `antenv` venv dance). It assumes the current flat repo layout; moving backend files breaks startup.
- **Stale path defaults in `core/config.py`** — `PDF_DIR` defaults to `frontend/Lecture Notes-20250622` and `LESSON_DIR` to `lessons_raw`; **neither directory exists**. Both are env-overridable; code paths relying on the defaults fail quietly. (Backlog item.)
- **CRA env vars are build-time** — changing `REACT_APP_*` requires a rebuild/redeploy, not an app-settings change.
- **node-pty native binaries** — on Azure run `npm rebuild node-pty --update-binary`; bind terminal-service to localhost only.
