# Copilot instructions — CodeTutor (concise, repo-specific)

Purpose: help an AI coding agent be immediately productive here. **The authoritative agent guide is the root [`AGENTS.md`](../AGENTS.md)** (hard rules: never push, never deploy, never touch `backend/vectorstore/`, secrets, or `.env*`); per-folder `AGENTS.md` files carry local rules. This file is a quick orientation, not a second source of truth.

## Big picture

- **Backend:** FastAPI app in `backend/` — entry point `backend/main.py` (the only `.py` at that level; 12 routers registered in a static list). Handlers in `backend/routers/` stay thin; business logic lives in `backend/services/`.
- **Shared infra:** `backend/core/` — `config.py` (all path/env config, `PROJECT_ROOT` = `backend/`), `database.py` (lazy engine), `db_models.py` (SQLAlchemy models), `models.py` (HKBU LLM/embeddings clients), `rate_limiter.py` (slowapi).
- **RAG:** `backend/services/rag_system.py` + `backend/routers/rag.py`; committed FAISS stores in `backend/vectorstore/` (hands off — binary artifacts, committed deliberately).
- **Scripts:** one-offs in `backend/scripts/` (`create_admin.py`, `rebuild_vectorstore.py`, `schema_migration.py`, …) — run as `python scripts/<name>.py` from `backend/`.
- **Frontend:** CRA app in `frontend/` (single folder — the old nested `frontend/frontend/` is gone). `src/` is organized into `pages/`, `components/`, `services/`, `utils/`, `data/` (see `frontend/src/AGENTS.md`).
- **Terminal service:** `terminal-service/` — Node ws server, plain `child_process`, no node-pty; backend proxy gated off by default (`ENABLE_TERMINAL`).

## Essential conventions

- **Router → Service:** add HTTP surface in `backend/routers/<feature>.py`, logic in `backend/services/<feature>.py`, register in the static list in `backend/main.py`, then re-run the import check.
- **RAG retriever per-request:** acquire the retriever at call time (see `backend/routers/rag.py`); no module-level retriever singletons.
- **Vectorstore is a committed binary artifact:** never edit or regenerate it casually; inspect metadata with `backend/vectorstore/extract_from_faiss.py`.
- **DB schema changes:** update `backend/core/db_models.py` together with `backend/scripts/schema_migration.py` (there is no `migrate_to_postgres.py`).

## Developer commands

```bash
# Backend (venv at repo root)
python -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
cd backend && uvicorn main:app --reload     # OpenAPI: http://localhost:8000/docs

# Fast verification (from backend/)
python -c "import main"

# Offline tests (from backend/; deps: backend/requirements-dev.txt)
python -m pytest tests/ -q --ignore=tests/test_acceptance.py --ignore=tests/test_browser_compat.py --ignore=tests/locustfile.py

# Frontend
cd frontend && npm install && npm start     # http://localhost:3000
```

Full runbook (env vars, container image, deploy mechanics): [`docs/OPS.md`](../docs/OPS.md). Task state: `docs/backlog.md`, `docs/plans/`.

## Gotchas

- Both GitHub Actions deploy workflows are latent (currently `disabled_manually`) but re-armable — **never push**; commit locally on a branch.
- `backend/**`, `frontend/**`, `terminal-service/**`, and `startup.sh` all match deploy path filters.
- CRA `REACT_APP_*` vars are build-time; a change needs a rebuild.
- External code execution uses the Paiza API (`PAIZA_API_KEY` via `backend/core/config.py`).
