# backend/ — FastAPI app

Everything server-side: API, auth, RAG pipeline, DB models. Entry point `main.py` (12 routers in a static list, ~line 550) is the only `.py` at this root (tidied 2026-10-23). All path/env config derives from `core/config.py` (`PROJECT_ROOT` = this folder). Shared infra lives in `core/` (config, limiter, `database.py`, `db_models.py`, `models.py` = HKBU LLM/embeddings clients); the RAG pipeline in `services/rag_system.py`; runnable one-offs in `scripts/` (run as `python scripts/<name>.py` from this folder).

## Rules

- **Never touch `vectorstore/`, secrets, or any `.env*` file** — the FAISS stores are committed deliberately; hands off (root [/AGENTS.md](../AGENTS.md) hard rule 3).
- **Any `backend/**` change matches the latent deploy filter** — commit locally on a branch, never push (hard rule 1).
- Router → service pattern: API handlers in `routers/`, business logic in `services/`. New logic goes in a service.
- `scripts/schema_migration.py` and `scripts/rebuild_vectorstore.py` are state-changing — ask the owner before running.
- Treat `quiz_questions.csv` as data (backlog KI-9 tracks moving it out of git).

## Commands (run from this folder, venv active)

- Dev server: `uvicorn main:app --reload` → http://localhost:8000/docs
- Fast verification: `python -c "import main"` (app + all routers import)
- Offline tests: `python -m pytest tests/ -q --ignore=tests/test_acceptance.py --ignore=tests/test_browser_compat.py --ignore=tests/locustfile.py` (deps: `requirements-dev.txt`)

Full runbook: [docs/OPS.md](../docs/OPS.md).

## Map

| Path | Guide |
|---|---|
| `routers/` | [routers/AGENTS.md](routers/AGENTS.md), [docs/modules/backend-routers.md](../docs/modules/backend-routers.md) |
| `services/` | [services/AGENTS.md](services/AGENTS.md) |
| `tests/` | [tests/AGENTS.md](tests/AGENTS.md) |
| `services/rag_system.py`, `vectorstore/` | [docs/modules/rag-pipeline.md](../docs/modules/rag-pipeline.md) |
| auth/classroom/DB (`core/db_models.py`) | [docs/modules/classroom-roles.md](../docs/modules/classroom-roles.md) |
| `core/` | config (`config.py`), slowapi limiter, topic mapping, utils, DB (`database.py`, `db_models.py`), LLM clients (`models.py`) |
| `scripts/` | one-off/maintenance scripts (create_admin, schema_migration, rebuild_vectorstore, create_tables, …) |
| `Dockerfile` | [docs/OPS.md §Container](../docs/OPS.md) — never push images |
| `java_docs/`, `evaluation/` | RAG corpus / NLI eval outputs — data, not code |
