# ☕ CodeTutor — Java Learning Platform

Monorepo for an AI-powered Java learning platform (backend + frontend).

Overview

- Backend: FastAPI app (API, RAG orchestration, DB access).
- Frontend: React app in `frontend/` (UI, progress sync, code playground).
- RAG / Vectorstore: FAISS index and helpers in `vectorstore/`.

Quick start

- Prepare Python environment and install deps:
	```bash
	source .venv/bin/activate
	pip install -r requirements.txt
	```

- Run backend (development):
	```bash
	uvicorn main:app --reload
	# API docs: http://localhost:8000/docs
	```

- Run frontend (development):
	```bash
	cd frontend
	npm install
	npm start
	# Frontend runs at http://localhost:3000
	```

Test account (dev)

- Email: `test@test.com`
- Password: `test1234`

Features

- RAG-based AI Tutor with NLI faithfulness checks
- Roadmap and topic progress tracking
- Quizzes (MCQ) and practical coding tests with auto-grading
- In-browser Java playground

Database

- Default: SQLite (`learning_platform.db`) created on first run.
- Key files: `database.py`, `db_models.py`, `migrate_to_postgres.py`.
- Recreate the dummy account (example):
	```bash
	python -c "
	import bcrypt
	from database import SessionLocal
	from db_models import User

	db = SessionLocal()
	pwd_hash = bcrypt.hashpw('test1234'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
	user = User(email='test@test.com', password_hash=pwd_hash, full_name='Test User')
	db.add(user)
	db.commit()
	print('Done!')
	db.close()
	"
	```

Vectorstore / RAG notes

- The FAISS binary is stored at `vectorstore/index.faiss` with metadata in `vectorstore/faiss_summary.json`.
- Do not commit or edit `index.faiss` unless intentionally rebuilding the index. Use `vectorstore/extract_from_faiss.py` to extract or rebuild metadata.

Developer tips & conventions

- Router → Service: add API handlers under `routers/` and put business logic in `services/`.
- For RAG flows, acquire a retriever per-request (see `routers/rag.py` and `rag_system.py`). Avoid module-level retriever singletons.
- External-run integrations (e.g., Paiza) rely on env vars configured in `core/config.py`.

Questions / next steps

- This README is now the canonical doc. I removed the duplicate `frontend/README.md`. If you prefer splitting frontend docs again, I can re-create a short frontend-only README.
