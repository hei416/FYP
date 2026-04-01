# Copilot instructions — CodeTutor (concise, repo-specific)

**Purpose:** Help an AI coding agent be immediately productive in this Java learning platform repository.

## Architecture & Key Components

**Big Picture:**
- **Backend:** FastAPI app (`main.py`). Routes live in `routers/`—keep them thin; business logic goes in `services/`.
- **Frontend:** React app in `frontend/` (canonical dev target; there is a nested `frontend/frontend/` with identical `package.json`).
- **Data Layer:** `database.py` (lazy-load connection), `db_models.py` (SQLAlchemy ORM models), `migrate_to_postgres.py` (lightweight migrations).
- **RAG / Vectorstore:** `rag_system.py` orchestrates RAG. FAISS binary lives in `vectorstore/index.faiss` with metadata in `vectorstore/faiss_summary.json`.
- **Config & Secrets:** `core/config.py` centralizes env-driven settings (`API_KEY`, `PAIZA_API_KEY`, LLM model names, retrieval params).
- **Code Execution:** Paiza API integration for compiling/running Java. Handles class-name-to-filename validation and main-class normalization.
- **Auth & Multi-tenancy:** JWT-based auth (`routers/auth.py`). Classrooms (`Classroom`, `ClassroomMember`) enable scoped RAG queries.

## Essential Patterns (Do Not Change)

1. **Router → Service:** HTTP validation/routing in `routers/<feature>.py`; core logic in `services/<feature>.py`.
   - *Example:* `routers/rag.py` routes `/ask` requests; calls `rag_system.py` and `services/conversation_manager.py` for RAG.

2. **RAG Retriever Per-Request:** Acquire retriever at call time; avoid module-level singletons.
   - In `main.py`: `RAG_INITIALIZED` flag + `ensure_rag_initialized()` ensures lazy, thread-safe load on first request.
   - Router example: `routers/rag.py` passes retriever to `call_llm()` and RAG chains.

3. **Lazy DB Connection:** `database.py` uses lazy engine/sessionmaker initialization to prevent connection timeouts at import.

4. **Vectorstore as Binary Artifact:** Never edit `vectorstore/index.faiss` directly. Use `vectorstore/extract_from_faiss.py` to rebuild/inspect metadata.

5. **Multi-Classroom RAG:** `services/classroom_rag.py` filters retriever results by classroom context. Verify `ClassroomMember` enrollment before answering.

6. **Code Execution Validation:** `routers/code_execution.py` normalizes Java class names and validates filename-matches-class before submitting to Paiza.

## Critical Files & Roles

| File/Dir | Role |
|----------|------|
| `main.py` | App wiring, router registration, lazy RAG/PDF init, CORS. |
| `routers/` | 12 routers: `auth.py`, `rag.py`, `code_execution.py`, `lessons.py`, `practical_tests.py`, `classroom.py`, `conversation.py`, `progress.py`, `my_work.py`, `pdfs.py`, `admin.py`. |
| `services/` | `classroom_rag.py`, `conversation_manager.py`, `error_explainer.py`, `pdf_service.py`. |
| `rag_system.py` | Setup FAISS, embeddings (HKBU API or Azure fallback), LLM chain, retriever. |
| `db_models.py` | 9 models: `User`, `Classroom`, `ClassroomMember`, `SavedWork`, `UserProgress`, `QuizQuestion`, `PracticalTestHint`, etc. |
| `database.py` | Lazy engine + sessionmaker factory; supports SQLite (dev) or PostgreSQL. |
| `core/config.py` | API_KEY, PAIZA_API_KEY, FAISS model/embedding params, retrieval K/LAMBDA_MULT. |
| `frontend/src/ragDocMapping.js` | Auto-generated mapping of lesson topics to FAISS sources. |
| `core/topic_mapping.py` | Subtopic-to-main-topic conversion for progress tracking. |

## Developer Workflows

**Setup Python & Backend:**
```bash
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
# OpenAPI docs: http://localhost:8000/docs
```

**Frontend (Canonical: top-level `frontend/`):**
```bash
cd frontend
npm install
npm start
# App at http://localhost:3000
```

**Rebuild Vectorstore Metadata:**
```bash
python vectorstore/extract_from_faiss.py
# Regenerates faiss_summary.json and ragDocMapping.js
```

**DB Migrations:**
```bash
python migrate_to_postgres.py
# Also creates dummy account if needed.
```

**Test Account (dev):**
- Email: `test@test.com`
- Password: `test1234`

## Adding a New Feature

**New Backend Endpoint:**
1. Create `routers/my_feature.py` with validation, call to `services/my_feature.py`.
2. Create `services/my_feature.py` with core logic.
3. Import and register in `main.py`: `from routers import my_feature; app.include_router(my_feature.router)`.
4. If using RAG: call `await ensure_rag_initialized()` and pass retriever.
5. If using DB: depend on `get_db()` session; query models from `db_models.py`.

**DB Schema Changes:**
- Update `db_models.py` with new `Base` subclass or column changes.
- Update `migrate_to_postgres.py` with schema migration logic (if PostgreSQL).
- Test with SQLite first (default in dev).

**Classroom-Scoped Features:**
- Verify membership: `ClassroomMember.filter(...).first()` or check teacher/admin role.
- Use `services/classroom_rag.py` to filter RAG results by classroom context.

## Git & Artifacts

- **Do NOT commit** `vectorstore/index.faiss` unless intentionally updating the index.
- **Do commit** `vectorstore/faiss_summary.json` and `frontend/src/ragDocMapping.js` (derived metadata).
- **Do commit** database migrations in `migrate_to_postgres.py` and any new env var docs.

## Environment Variables

| Var | Purpose | Example |
|-----|---------|---------|
| `API_KEY` | HKBU LLM authentication. | (set in `.env` or CI) |
| `PAIZA_API_KEY` | Java code execution (Paiza). Default: `"guest"`. | (optional) |
| `SECRET_KEY` | JWT signing key. | (set in `.env`) |
| `DATABASE_URL` | DB connection. Default: SQLite. | `sqlite:///./learning_platform.db` or PostgreSQL URL |
| `FAISS_MODEL_NAME` | LLM model name. | `"qwen3-max"` |
| `FAISS_EMBEDDING_MODEL` | Embedding model. | `"text-embedding-3-small"` |

## Gotchas & Notes

1. **Two frontend folders:** Use `frontend/` for dev; both have identical `package.json`.
2. **Paiza class naming:** `routers/code_execution.py` normalizes public class names to `Main` for Paiza submission.
3. **HKBU API fallback:** `rag_system.py` falls back to Azure OpenAI if local models unavailable.
4. **Lazy RAG init:** First RAG request may take 5+ seconds while FAISS loads; subsequent requests are fast.
5. **Terminal service (optional):** `terminal-service/` is a Node.js PTY for interactive Java (use only in dev/controlled environments).

## Reference Examples

- **RAG endpoint:** `routers/rag.py::ask_classroom_rag()` shows per-request retriever usage.
- **Classroom context:** `services/classroom_rag.py::query_classroom_rag()` filters docs by classroom.
- **Code execution:** `routers/code_execution.py::normalize_public_class()` handles Java naming.
- **Progress tracking:** `routers/progress.py` queries `UserProgress` model and topic completions.
- **Quiz/Practical:** `routers/quiz.py` and `practical_tests.py` integrate with DB models and error explanation service.
