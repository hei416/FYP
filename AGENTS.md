# CodeTutor (FYP) — Agent Guide

Java learning platform (final-year project). FastAPI backend at the **repo root**, React (CRA) frontend in `frontend/`, Node PTY terminal service in `terminal-service/`, FAISS vector stores **deliberately committed** in `vectorstore/` for fast Azure startup.

## Hard rules — read before doing anything

1. **Never push.** A push to `main` deploys straight to the two live Azure App Services (path-filtered GitHub Actions). Commit locally on a branch; only the owner pushes.
2. **Never deploy.** No `az`, no Azure portal/app settings, no `gh workflow run`.
3. **Never touch `vectorstore/`, secrets, or any `.env*` file** — do not read, edit, move, or commit them. `frontend/.env.*` are git-tracked; leave them alone.
4. **One task per session.** Work in a **git worktree** on a branch, never directly on `main`.
5. **Commit before stopping.** Leave a clean tree and update the Status block of your plan file in `docs/plans/active/` as the handoff note.

## Deploy triggers (why pushing is dangerous)

- `.github/workflows/backend.yml` fires on **any `*.py` anywhere**, `requirements.txt`, `startup.sh`, `routers/`, `services/`, `core/`, `vectorstore/`, `practical_tests/` → deploys the backend (`codetutor-fyp-hei`).
- `.github/workflows/frontend.yml` fires on `frontend/**` and the stale root filters `public/**`, `src/**`, `package.json` → deploys the frontend.
- Deploy-inert paths: `*.md`, `docs/`, `.claude/`, `*.ipynb`, `*.csv`, `.gitignore`, `.env.example`.

## Where things live

| Path | What |
|---|---|
| `main.py` | FastAPI app; 13 routers registered in a static list |
| `core/config.py` | All path/env config; everything derives from `PROJECT_ROOT` |
| `routers/` / `services/` | API handlers / business logic (router → service pattern) |
| `rag_system.py`, `vectorstore/` | RAG pipeline + committed FAISS stores |
| `frontend/` | CRA app (localhost:3000) |
| `terminal-service/` | ws + node-pty server (localhost:3001) |
| `tests/` | pytest + Playwright E2E + locust (deps NOT in requirements.txt) |
| `docs/` | All project docs — see map below |

## Run / test / build / deploy

Full runbook: **[docs/OPS.md](docs/OPS.md)**. Quick version:

- Backend: `source .venv/bin/activate && uvicorn main:app --reload` (API docs at :8000/docs)
- Frontend: `cd frontend && npm install && npm start`
- Terminal service: `cd terminal-service && npm install && node server.js`
- Import check (fast verification): `python -c "import main"` in the venv
- Frontend build check: `cd frontend && npm run build`
- Deploy: **automatic on push to `main`** — see hard rule 1. There is no manual deploy step for agents.

## Docs map

- Runbook / ops: `docs/OPS.md`
- Module guides: `docs/modules/` (routers, RAG pipeline, RAG evaluation, code playground, classroom roles, frontend)
- Plans: `docs/plans/active/` (one file per task, `YYYY-MM-DD_<topic>_<status>.md`, with a Status block); move to `docs/plans/done/` when finished
- Backlog: `docs/backlog.md` (Ready / Waiting / Needs human / Unclear / Parked / Done)
- Decisions: `docs/strategy/decision-log.md` — append-only, entries only with owner-confirmed wording
- Archives: `docs/_archives/`

## Verification before any commit

1. Secret-scan the diff (no keys, tokens, passwords).
2. List changed paths and confirm none match a CI path filter above (unless the owner explicitly approved a deploy-triggering change).
3. Small commits, one logical group each; finish with a clean tree.
