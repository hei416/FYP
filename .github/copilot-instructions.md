
# Copilot instructions — CodeTutor (concise, repo-specific)

Purpose: help an AI coding agent be productive quickly in this repository.

Key components
- Backend: FastAPI app entry `main.py`. Routers in `routers/` (per-feature), business logic in `services/`.
- Frontend: React app under `frontend/` — note there are nested `frontend/` folders; inspect `frontend/package.json` vs `frontend/frontend/package.json` to determine which to run.
- Database: models in `db_models.py` and `database.py`. Migration helper: `migrate_to_postgres.py`.
- RAG & Vectorstore: core RAG code in `rag_system.py`; FAISS index and helpers live in `vectorstore/` (`index.faiss`, `extract_from_faiss.py`).

Quick start (developer commands)
- Activate venv and install: `source .venv/bin/activate && pip install -r requirements.txt`.
- Start backend: `uvicorn main:app --reload` — API UI at `http://localhost:8000/docs`.
- Start frontend: `cd frontend` (or `cd frontend/frontend` if needed), then `npm install && npm start`.
- Regenerate vectorstore / migrate DB: inspect and run `python migrate_to_postgres.py` and `python vectorstore/extract_from_faiss.py` as needed.

Project conventions (do this same way)
- Router → Service: keep HTTP handlers in `routers/` thin; put business rules in `services/`.
- Models: update `db_models.py` and any migration scripts together; preserve field names to avoid breakage.
- RAG initialization: use `await get_retriever()` or `ensure_rag_initialized()`; do not rely on module-level `retriever` globals (see `routers/rag.py`).
- Vectorstore: treat FAISS files as binary artifacts; use provided scripts to rebuild indexes.

Concrete examples
- New lesson endpoint: add `routers/lessons.py`, implement logic in `services/lessons.py`, and register the router in `main.py`.
- RAG call pattern: in `routers/rag.py` use `retriever = await get_retriever()` then pass to RAG helpers; follow existing usage sites for pagination/embedding choices.
- Frontend calls: examine `frontend/src/ragDocMapping.js` and `frontend/src/progressService.js` for request/response shapes.

Files to read first
- `main.py`, `routers/`, `services/`, `rag_system.py`, `vectorstore/`, `db_models.py`, `migrate_to_postgres.py`, `frontend/src/`.

If something is unclear (which `frontend` folder is primary, RAG init timing, or DB credentials), tell me which area to expand and I will refine these instructions.
