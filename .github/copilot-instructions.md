# Copilot instructions — CodeTutor (concise, repo-specific)

Purpose: Help an AI coding agent be immediately productive in this repository.

Big picture
- Backend: FastAPI app wired in `main.py`. Routes live in `routers/` and should be thin; business logic belongs in `services/`.
- Frontend: React app in `frontend/`. There is a nested `frontend/frontend/`—confirm which `package.json` has the `start` script; prefer the top-level `frontend/` for dev.
- Data layer: `database.py` (connection), `db_models.py` (ORM models). Use `migrate_to_postgres.py` for simple migrations.
- RAG / Vectorstore: RAG orchestration is in `rag_system.py`. Vectorstore lives in `vectorstore/` (binary `index.faiss`, metadata `faiss_summary.json`, helper `extract_from_faiss.py`).
- Config & secrets: `core/config.py` centralizes API keys and env-driven settings (e.g., `PAIZA_API_KEY`).

Essential conventions (do not change)
- Router → Service: Add HTTP handlers under `routers/<feature>.py` and implement logic in `services/<feature>.py`. Handlers should validate inputs and call services.
- Retriever per-request: For RAG flows, acquire a retriever at call time (see `routers/rag.py`). Avoid module-level retriever singletons.
- Vectorstore is a binary artifact: never edit `vectorstore/index.faiss` directly. Use `vectorstore/extract_from_faiss.py` to rebuild/inspect.
- DB schema changes: update `db_models.py` and `migrate_to_postgres.py` together.

Key files to inspect (quick links)
- App wiring: `main.py` — router registration, middleware, OpenAPI.
- Example RAG usage: `routers/rag.py` and `rag_system.py`.
- Backend patterns: `routers/` and `services/` folders.
- Data & migrations: `database.py`, `db_models.py`, `migrate_to_postgres.py`.
- Vectorstore: `vectorstore/extract_from_faiss.py`, `vectorstore/faiss_summary.json`.
- Frontend integration: `frontend/src/ragDocMapping.js`, `frontend/src/*` components.

Developer commands
- Setup Python env and deps:
  ```bash
  source .venv/bin/activate
  pip install -r requirements.txt
  ```
- Run backend (dev):
  ```bash
  uvicorn main:app --reload
  # OpenAPI: http://localhost:8000/docs
  ```
- Run frontend (dev):
  ```bash
  # confirm which package.json has `start` then:
  cd frontend && npm install && npm start
  ```
- Rebuild or extract vectorstore metadata:
  ```bash
  python vectorstore/extract_from_faiss.py
  ```
- Run migrations / simple DB helpers:
  ```bash
  python migrate_to_postgres.py
  ```

PR / change checklist (practical)
- Add route: create `routers/<feature>.py` and `services/<feature>.py`.
- Register router: import and `app.include_router(...)` in `main.py`.
- If DB changed: update `db_models.py` and `migrate_to_postgres.py`.
- If RAG touched: call `get_retriever()` per-request and document any index rebuild steps.
- Do not commit `vectorstore/index.faiss` unless intentionally updating the index artifact.

Notes / gotchas
- There are two `frontend` folders — always confirm `scripts.start` before running the frontend.
- External code-run integrations (e.g., Paiza) use credentials from `core/config.py`; ensure env vars are set locally.
- Use `routers/rag.py` as the canonical example for how to pass a retriever into `rag_system.py`.

If anything is missing or you'd like a sample PR checklist adapted to a specific feature, tell me which area to expand.

# Copilot instructions — CodeTutor (concise, repo-specific)

Purpose: Make an AI coding agent productive in this repository quickly.

Key components (big picture)
- Backend: FastAPI app at `main.py`. Feature routes live under `routers/`; keep handlers thin and put business logic in `services/`.
- Frontend: React app in `frontend/`. There is a nested `frontend/frontend/`—check which `package.json` contains the `start` script before running.
 - Frontend: React app in `frontend/`. There is a nested `frontend/frontend/`—check which `package.json` contains the `start` script before running.
	 - Canonical dev target: use the top-level `frontend/` folder. Both `frontend/package.json` and `frontend/frontend/package.json` are identical in this repo; prefer `frontend/` unless a different deploy config exists.
- Data layer: `database.py` and `db_models.py` define DB connections and ORM models. `migrate_to_postgres.py` is the simple migration helper.
- RAG / Vectorstore: `rag_system.py` contains RAG orchestration. FAISS index and helpers live in `vectorstore/` (e.g., `index.faiss`, `extract_from_faiss.py`).

Quick developer commands
- Python env and deps: `source .venv/bin/activate && pip install -r requirements.txt`.
- Run backend: `uvicorn main:app --reload` (OpenAPI at `/docs`).
- Run frontend: inspect `frontend/package.json` and `frontend/frontend/package.json` to pick which folder has `scripts.start`. Typical commands:
	- `cd frontend && npm install && npm start` or
	- `cd frontend/frontend && npm install && npm start`.
- Rebuild vectorstore / summaries: `python vectorstore/extract_from_faiss.py` (or the frontend copy under `frontend/vectorstore/` if used there).
- DB dump / migrate: `python migrate_to_postgres.py` and backup file `backup_learning_platform.sql` present for restores.

Project conventions & patterns (specific)
- Router → Service: Add HTTP surface in `routers/<feature>.py` and place business rules in `services/<feature>.py`.
	Example: to add a new API, create `routers/my_feature.py`, implement `services/my_feature.py`, then register the router in `main.py`.
- RAG pattern: Always acquire a retriever at call time: `retriever = await get_retriever()` or call `ensure_rag_initialized()`; avoid module-level retriever globals (see `routers/rag.py`).
- Vectorstore handling: `vectorstore/index.faiss` is a binary artifact—do not edit directly in Git. Use `extract_from_faiss.py` to regenerate or extract metadata.
- DB models: Keep `db_models.py` and `database.py` aligned; migration is lightweight—update both when changing schema.
- Code execution integration: The project calls external code-run APIs (e.g., Paiza). Credentials are stored in `core/config.py` (e.g., `PAIZA_API_KEY`)—check environment variables before running.

Integration & environment notes
- Postgres: connection details used by migration scripts; examples in repo show usage of `PGPASSWORD` for `pg_dump`/`psql` commands.
- Secrets: `core/config.py` reads some API keys—when running locally set env vars (e.g., `PAIZA_API_KEY`, `PGPASSWORD`).

Where to look first (recommended reading order)
1. `main.py` — app wiring and router registration.
2. `routers/` — HTTP endpoints; good for request shapes and auth patterns.
3. `services/` — core business logic implementations.
4. `rag_system.py` and `vectorstore/` — RAG flow, retriever usage, and FAISS handling.
5. `db_models.py`, `database.py`, and `migrate_to_postgres.py` — schema and migration patterns.
6. `frontend/` (and nested `frontend/frontend/`) — UI shapes, `ragDocMapping.js`, and client-side request patterns.

Concrete examples to follow
- New lesson endpoint: add `routers/lessons.py`, put logic in `services/lessons.py`, update DI / registration in `main.py`.
- RAG call: see `routers/rag.py` for `await get_retriever()` usage and passing retriever into RAG helpers.
- Vectorstore rebuild: run `python vectorstore/extract_from_faiss.py` and commit only derived metadata (not the `.faiss` binary unless intentionally updated).

If you update these instructions
- Preserve the Router→Service guidance and RAG retriever pattern.
- Keep commands realistic: prefer `uvicorn main:app --reload` and checking `frontend/package.json` to choose the frontend folder.

Questions / gaps
- Which `frontend` folder should be the canonical dev target? If you want, I can inspect both `package.json` files and mark the correct one.

Feedback
Please review and tell me if you'd like more examples (e.g., a sample new-route PR checklist, or explicit env var names and defaults).

PR Checklist — Adding a new backend route
- **Router/Service:** Add `routers/<feature>.py` and `services/<feature>.py` (keep handler thin).
- **Register:** Register the router in `main.py` (import and `app.include_router(...)`).
- **Docs / Manual Test:** Verify OpenAPI at `/docs` and exercise endpoint with `curl` or `httpie`.
- **DB changes:** If adding DB fields, update `db_models.py` and `migrate_to_postgres.py`; include migration notes in PR.
- **Env / Secrets:** Document any new env variables (e.g., in `core/config.py`) in the PR description.
- **Vectorstore / RAG:** If the route interacts with RAG, ensure `get_retriever()` is called per-request and mention any index rebuild commands used.

PR Checklist — Frontend changes
- **Folder:** Use the top-level `frontend/` for development; only use `frontend/frontend/` if deploy tooling points to it.
- **Build / Test:** Run `npm install` then `npm start` in `frontend/` and exercise UI flows that call your API.
- **API contracts:** Check request/response shapes in `frontend/src/ragDocMapping.js`, `frontend/src/progressService.js`, and update mocks if needed.
- **Assets / Vectorstore:** If frontend touches `vectorstore/`, only update derived metadata (e.g., `faiss_summary.json`); do not commit `index.faiss` unless intended.
- **Static changes:** Update `public/` files (e.g., `index.html`) and `frontend/src/` components; run lint/tests if present.
- **Docs / PR notes:** Note env variables or backend endpoints required (e.g., CORS, backend base URL) in the PR description.
