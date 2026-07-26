# ☕ CodeTutor — AI-Powered Java Learning Platform

> An intelligent, RAG-based platform for learning Java — featuring an AI tutor, interactive coding playground, quizzes, and classroom management.

![Language](https://img.shields.io/badge/Backend-Python%20%2F%20FastAPI-blue)
![Language](https://img.shields.io/badge/Frontend-React-61DAFB)
![DB](https://img.shields.io/badge/Database-SQLite%20%2F%20PostgreSQL-green)
![AI](https://img.shields.io/badge/AI-RAG%20%2B%20FAISS%20%2B%20NLI-orange)

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [Vectorstore / RAG Notes](#vectorstore--rag-notes)
- [Interactive Terminal](#interactive-terminal-dev--deploy)
- [Developer Tips](#developer-tips--conventions)
- [Known Issues & TODOs](#known-issues--todos)
- [Security & Configuration](#security--configuration)

---

## Overview

CodeTutor is a full-stack AI-powered Java learning platform built as a Final Year Project (FYP) at HKBU. It combines a FastAPI backend, React frontend, FAISS vectorstore, and HKBU's qwen3-max LLM to deliver intelligent, context-aware Java tutoring.

**Tech Stack:**

| Layer | Technology |
|---|---|
| Backend | Python, FastAPI, SQLAlchemy |
| Frontend | React (JavaScript) |
| Database | SQLite (dev) / PostgreSQL (prod) |
| AI / RAG | FAISS, sentence-transformers, HKBU qwen3-max |
| Code Execution | Paiza API + Node.js PTY (terminal-service) |
| Deployment | Docker, Azure App Service |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    React Frontend                    │
│         (UI, progress sync, code playground)         │
└────────────────────┬────────────────────────────────┘
                     │ HTTP / WebSocket
┌────────────────────▼────────────────────────────────┐
│               FastAPI Backend (main.py)              │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │  routers/  │  │  services/   │  │  core/      │  │
│  │  auth      │  │  classroom   │  │  config.py  │  │
│  │  rag       │  │  rag         │  │  rate_lim.  │  │
│  │  quiz      │  │  quiz        │  └─────────────┘  │
│  │  code_exec │  └──────────────┘                   │
│  └────────────┘                                     │
└──────┬───────────────┬────────────────┬─────────────┘
       │               │                │
┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────────────┐
│  SQLite /   │ │   FAISS     │ │  HKBU qwen3-max LLM  │
│  PostgreSQL │ │ Vectorstore │ │  (primary, $0 cost)  │
└─────────────┘ └─────────────┘ └──────────────────────┘
```

### LLM Resilience Strategy

```
Request → /ragAI
  ↓
Try: HKBU qwen3-max (97% accuracy, university API)
  ↓ (success) → Return AI answer + PDF matches
  ↓ (failure) → Retrieval-only fallback (documents + message)
  ↓ (future)  → Local Llama 2 CPU-only (see local_llm_fallback.py)
```

**Cost: $0** — runs entirely on university infrastructure.

---

## Features

- **RAG-based AI Tutor** — answers Java questions using course PDFs with NLI faithfulness checks
- **Roadmap & Progress Tracking** — topic-by-topic learning path with completion states
- **Quizzes (MCQ)** — auto-graded multiple choice questions
- **Practical Coding Tests** — in-browser Java execution via Paiza API
- **Interactive Java Playground** — full PTY-based terminal (`terminal-service/`) supporting `Scanner` input
- **Classroom Management** — teachers can create classrooms, upload documents, manage students
- **PDF Viewer with Text Highlight** — displays source documents with relevant passages highlighted
- **Admin Panel** — user management via `create_admin.py`

---

## Project Structure

```
FYP/
├── main.py                   # FastAPI app entry point
├── database.py               # DB connection & session
├── db_models.py              # SQLAlchemy ORM models
├── models.py                 # Pydantic request/response schemas
├── rag_system.py             # RAG retrieval + LLM orchestration
├── local_llm_fallback.py     # CPU-only Llama 2 fallback (disabled)
├── rebuild_vectorstore.py    # Rebuild FAISS index from documents
├── schema_migration.py       # DB migration helpers
├── create_admin.py           # Create admin user script
├── requirements.txt          # Python dependencies
├── docker-compose.yml        # Docker setup
├── startup.sh                # Azure startup script
│
├── core/
│   ├── config.py             # App config, env vars, DEBUG_MODE
│   └── rate_limiter.py       # slowapi rate limiter singleton
│
├── routers/
│   ├── auth.py               # Login, register, JWT
│   ├── rag.py                # /ragAI endpoint (rate-limited)
│   ├── quiz.py               # MCQ quiz endpoints
│   ├── code_execution.py     # /api/run-code (rate-limited)
│   └── ...                   # Other routers
│
├── services/
│   └── classroom_rag.py      # File validation, classroom RAG logic
│
├── frontend/                 # React app
│   └── src/
│       ├── classroomService.js
│       └── TeacherClassroomDetail.js
│
├── vectorstore/
│   ├── index.faiss           # FAISS binary (do not edit manually)
│   └── faiss_summary.json    # Metadata for vectorstore entries
│
├── terminal-service/         # Node.js PTY microservice
│   └── server.js
│
├── evaluation/               # Model evaluation scripts
├── practical_tests/          # Practical test definitions
├── tests/                    # Unit tests
├── scripts/                  # Utility scripts
├── java_docs/                # Java course documents (PDFs)
└── public/                   # Static files
```

---

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- (Optional) Docker

### 1. Backend

```bash
# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set required environment variables (see below)
cp .env.example .env            # or set manually

# Run backend (development)
uvicorn main:app --reload
# API docs: http://localhost:8000/docs
```

### 2. Frontend

```bash
cd frontend
npm install
npm start
# Frontend: http://localhost:3000
```

### 3. Terminal Service (optional, for interactive Java stdin)

```bash
cd terminal-service
npm install
node server.js
# WebSocket: ws://localhost:3001
```

### 4. Docker (all-in-one)

```bash
docker-compose up --build
```

### Test Account (dev)

| Field | Value |
|---|---|
| Email | `test@test.com` |
| Password | `test1234` |

---

## Environment Variables

Create a `.env` file in the project root:

```bash
# LLM API
API_KEY=your_hkbu_api_key

# Code execution (Paiza)
PAIZA_API_KEY=your_paiza_key

# Security
SECRET_KEY=your_jwt_secret_key

# Development only — enables /test-alive and /debug/routes
DEBUG_MODE=true

# Database (leave blank for SQLite default)
DATABASE_URL=

# Terminal service WebSocket URL (frontend)
REACT_APP_TERMINAL_WS=ws://localhost:3001
```

> ⚠️ Never commit `.env` to version control. `DEBUG_MODE` must be `false` (or unset) in production.

---

## Database

- **Default:** SQLite (`learning_platform.db`) — created automatically on first run.
- **Production:** PostgreSQL — set `DATABASE_URL` in environment.
- **Key files:** `database.py`, `db_models.py`, `schema_migration.py`

### Recreate Test User

```bash
python create_admin.py
```

Or manually:

```python
import bcrypt
from database import SessionLocal
from db_models import User

db = SessionLocal()
pwd_hash = bcrypt.hashpw('test1234'.encode(), bcrypt.gensalt()).decode()
user = User(email='test@test.com', password_hash=pwd_hash, full_name='Test User')
db.add(user)
db.commit()
db.close()
```

### Rebuild Vectorstore

```bash
python rebuild_vectorstore.py
```

> ⚠️ Do not manually edit `vectorstore/index.faiss`. Use `vectorstore/extract_from_faiss.py` to inspect or rebuild metadata.

---

## Vectorstore / RAG Notes

- FAISS index stored at `vectorstore/index.faiss`; metadata in `vectorstore/faiss_summary.json`.
- RAG system uses per-request retriever instances — **avoid module-level retriever singletons** (causes stale state issues).
- See `rag_system.py` and `routers/rag.py` for the full RAG pipeline.
- NLI faithfulness checks validate that AI answers are grounded in retrieved documents.

---

## Interactive Terminal (dev & deploy)

The `terminal-service/` Node.js microservice provides a PTY (via `node-pty`) for Java programs that need stdin (e.g., `Scanner`).

### Local Dev — Convenience Script

Install `concurrently` and add to `frontend/package.json`:

```json
"scripts": {
  "dev:with-terminal": "concurrently \"node ../terminal-service/server.js\" \"npm start\" --names \"TERM,FRONT\" --kill-others-on-fail"
}
```

Then: `npm run dev:with-terminal`

### Production / Azure Notes

- `node-pty` includes native binaries. On Azure App Service, run:
  ```bash
  cd terminal-service && npm rebuild node-pty --update-binary
  ```
- **Recommended:** Run `terminal-service` as a separate service (PM2 / systemd / container) and proxy WebSocket through FastAPI backend.
- Bind the service to `localhost` only — never expose it publicly without authentication.

---

## Developer Tips & Conventions

- **Router → Service pattern:** API handlers go in `routers/`, business logic in `services/`.
- **Rate limiting:** `/ragAI` — 30 req/min; `/api/run-code` — 20 req/min (via `slowapi`).
- **External integrations** (e.g., Paiza) rely on env vars in `core/config.py`.
- **Debug endpoints** (`/test-alive`, `/debug/routes`) are only registered when `DEBUG_MODE=true`.
- **File uploads:** Max 50 MB, allowed types: PDF, TXT, DOCX, DOC.

### Debug Mode

```bash
# Development (debug endpoints visible)
DEBUG_MODE=true uvicorn main:app --reload

# Production (debug endpoints return 404)
uvicorn main:app
```

---

## Known Issues & TODOs

### 🔴 Phase 2 Fixes (Pending)

| # | Issue | File | Status |
|---|---|---|---|
| 1 | Password strength validation not yet wired to auth endpoints | `routers/auth.py` | ⏳ Pending |
| 2 | Generic 500 errors in some routers — need specific 4xx/5xx codes | `routers/*.py` | ⏳ Pending |
| 3 | No pagination on large query results (e.g., student lists) | `routers/` | ⏳ Pending |

### 🟡 Architecture / Improvement TODOs

| # | Issue | Notes |
|---|---|---|
| 4 | LLM retrieval-only fallback not fully implemented in `routers/rag.py` | Wrap `rag_chain()` in try-except for graceful degradation |
| 5 | `local_llm_fallback.py` (Llama 2 CPU) disabled — `OLLAMA_FALLBACK_ENABLED=False` | Enable post-FYP if local inference needed |
| 6 | `migrate_to_postgres.py` referenced in README but not present in root | Verify file location or update reference |
| 7 | `terminal-service` WebSocket not proxied through backend in production | Security risk if exposed directly |
| 8 | No `.env.example` file — developers must manually configure env vars | Add `.env.example` with placeholder values |
| 9 | `quiz_questions.csv` committed to repo — may contain sensitive test data | Consider moving to seeded DB or protected storage |
| 10 | Multiple loose `*.md` doc files in root (`BUG_FIX_REPORT_PHASE1.md`, `CONTENT_OVERLAP_ANALYSIS.md`, etc.) | Consider consolidating into a `/docs` folder |

### ✅ Completed Fixes (Phase 1 — April 2026)

- ✅ Structured logging added throughout (silent exceptions eliminated)
- ✅ Debug endpoints hidden behind `DEBUG_MODE` flag
- ✅ File upload validation — 50MB size limit + MIME type whitelist
- ✅ API rate limiting via `slowapi` (RAG: 30/min, code exec: 20/min)
- ✅ Classroom description inline-edit feature (teacher UI)
- ✅ PDF display with text highlight implemented

---

## Security & Configuration

- Bind `terminal-service` to `localhost` in production and proxy through your backend.
- `DEBUG_MODE` must be `false` (or unset) in all production deployments.
- JWT `SECRET_KEY` must be a long, random string — never use the default.
- File upload endpoints are protected by MIME type whitelist and 50MB size cap.
- Rate limiting is per-IP (not global) via `slowapi`.

---

> **Project Status:** FYP submission complete (April 2026). Phase 2 security and UX improvements are documented above and ready for post-submission implementation.
