# CodeTutor (FYP) — Agent Guide

Java learning platform (final-year project). FastAPI backend in **`backend/`** (moved from the repo root 2026-10-22, owner-approved decision #9), React (CRA) frontend in `frontend/`, Node terminal service in `terminal-service/` (plain `child_process` — no node-pty), FAISS vector stores **deliberately committed** in `backend/vectorstore/` for fast Azure startup.

## Hard rules — read before doing anything

1. **Never push.** Owner states (2026-10-22) the app has **never been deployed online / never live in production** — treat the path-filtered GitHub Actions deploy workflows as **latent, not dead**: a push to `main` may still start a real Azure deploy (and incur cost) if the secrets and App Services still exist, so the no-push rule stays until the owner lifts it. (CI history does show past deploy runs — evidence and open questions: `docs/reports/deployment-evidence-2026-10-22.md`.) Commit locally on a branch; only the owner pushes.
2. **Never deploy.** No `az`, no Azure portal/app settings, no `gh workflow run`.
3. **Never touch `backend/vectorstore/`, secrets, or any `.env*` file** — do not read, edit, move, or commit them. `frontend/.env.*` are git-tracked; leave them alone.
4. **One task per session.** Work in a **git worktree** on a branch, never directly on `main`.
5. **Commit before stopping.** Leave a clean tree and update the Status block of your plan file in `docs/plans/active/` as the handoff note.

## Deploy triggers (latent — why pushing is still off-limits)

- `.github/workflows/backend.yml` fires on `backend/**`, `startup.sh`, `terminal-service/**` (filters provisionally adjusted for the `backend/` layout 2026-10-22; final CI shape waits on the deploy-method decision) → would deploy the backend (`codetutor-fyp-hei`).
- `.github/workflows/frontend.yml` fires on `frontend/**` and the stale root filters `public/**`, `src/**`, `package.json` → would deploy the frontend.
- Deploy-inert paths: `*.md`, `docs/`, `.claude/`, `*.ipynb`, `*.csv`, `.gitignore`, `.env.example`.

## Where things live

| Path | What |
|---|---|
| `backend/main.py` | FastAPI app; 13 routers registered in a static list |
| `backend/core/config.py` | All path/env config; everything derives from `PROJECT_ROOT` (= `backend/`) |
| `backend/routers/` / `backend/services/` | API handlers / business logic (router → service pattern) |
| `backend/rag_system.py`, `backend/vectorstore/` | RAG pipeline + committed FAISS stores |
| `frontend/` | CRA app (localhost:3000) |
| `terminal-service/` | ws + `child_process` server (localhost:3001; no node-pty) |
| `backend/tests/` | offline unit tests (pytest, `backend/requirements-dev.txt`) + Playwright E2E + locust (E2E deps NOT in requirements.txt) |
| `startup.sh` | Azure startup script — stays at the repo root (startup command) |
| `backend/Dockerfile` | Host-agnostic backend image (DEPLOY-1 undecided) + `docker-compose.container.yml` smoke stack — see docs/OPS.md §Container |
| `docs/` | All project docs — see map below |

## Run / test / build / deploy

Full runbook: **[docs/OPS.md](docs/OPS.md)**. Quick version:

- Backend: `source .venv/bin/activate && cd backend && uvicorn main:app --reload` (API docs at :8000/docs)
- Frontend: `cd frontend && npm install && npm start`
- Terminal service: `cd terminal-service && npm install && node server.js`
- Import check (fast verification): `python -c "import main"` in the venv, run from `backend/`
- Offline tests: `cd backend && python -m pytest tests/ -q` (deps: `backend/requirements-dev.txt`)
- Frontend build check: `cd frontend && npm run build`; frontend tests: `CI=true npm test -- --watchAll=false` (green since FE-16)
- Container image: `backend/Dockerfile` — build/smoke commands in docs/OPS.md §Container (never push images or log in to a registry)
- Deploy: none is believed live (owner statement — hard rule 1), but a push to `main` **may still trigger** the latent workflows. There is no deploy step for agents; first-deploy gate: `docs/plans/active/first-deploy-readiness.md`.

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
