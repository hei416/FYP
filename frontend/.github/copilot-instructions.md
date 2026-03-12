# Copilot Instructions for CodeTutor (Java Learning Platform)

## Project Overview
- **CodeTutor** is an AI-powered Java learning platform with a backend (Python FastAPI) and frontend (React).
- Key features: RAG-based tutoring, quizzes, practical tests, code playground, progress tracking.

## Architecture & Structure
- **Backend:**
  - Located in root and `core/`, `routers/`, `services/`, `models.py`, `database.py`.
  - Uses FastAPI, with routers for modular endpoints (e.g., `routers/lessons.py`, `routers/practical_tests.py`).
  - Data models in `db_models.py`, `models.py`.
  - RAG system logic in `rag_system.py`.
  - Database migrations/scripts: `migrate_to_postgres.py`, `initdb.py`.
- **Frontend:**
  - Located in `frontend/` and `src/`.
  - React app with components for lessons, quizzes, playground, progress.
  - Uses `npm` for builds, `npm start` for dev server.

## Developer Workflows
- **Backend:**
  - Install dependencies: `pip install -r requirements.txt`
  - Run server: `uvicorn main:app --reload`
  - API docs: `http://localhost:8000/docs`
- **Frontend:**
  - Install dependencies: `npm install` (in `frontend/`)
  - Run dev server: `npm start`
- **Testing:**
  - Dummy account: `test@test.com` (see README)
  - Practical tests in `practical_tests/`

## Patterns & Conventions
- **Routers:** All API endpoints are grouped by feature in `routers/`.
- **Services:** Business logic is separated in `services/`.
- **Models:** Data models are defined in `db_models.py`, `models.py`.
- **RAG:** Retrieval-Augmented Generation logic is in `rag_system.py`.
- **Frontend:** React components are in `src/`, with CSS in `index.css`, `App.css`.

## Integration Points
- **Backend ↔ Frontend:** Communicate via REST API (`/api/*` endpoints).
- **Database:** Uses Postgres (see `migrate_to_postgres.py`).
- **Vectorstore:** FAISS index for document retrieval (`vectorstore/`).

## Examples
- To add a new lesson endpoint: create a router in `routers/lessons.py`, update models, and add business logic in `services/`.
- To extend frontend: add a React component in `src/`, update API calls as needed.

## References
- See `README.md` (root and frontend/) for setup, test account, and quickstart.
- Key files: `main.py`, `routers/`, `services/`, `models.py`, `rag_system.py`, `frontend/src/`.

---

**Update this file if major architecture or workflow changes occur.**

## RAG System
- Always access retriever via `await get_retriever()` in routers/rag.py
- Never read the `retriever` global directly in endpoints
- `ensure_rag_initialized()` in main.py is the single init entry point
