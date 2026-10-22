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
| Code Execution | Paiza API + Node.js terminal-service (plain `child_process`, no PTY) |
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
- **Interactive Java Playground** — interactive terminal (`terminal-service/`, plain `child_process` — no PTY) supporting `Scanner` input
- **Classroom Management** — teachers can create classrooms, upload documents, manage students
- **PDF Viewer with Text Highlight** — displays source documents with relevant passages highlighted
- **Admin Panel** — user management via `create_admin.py`

---

## Project Structure

```
FYP/
├── backend/                  # Python FastAPI backend (restructured 2026-10)
│   ├── main.py               # FastAPI app entry point
│   ├── database.py           # DB connection & session
│   ├── db_models.py          # SQLAlchemy ORM models
│   ├── models.py             # Pydantic request/response schemas
│   ├── rag_system.py         # RAG retrieval + LLM orchestration
│   ├── local_llm_fallback.py # CPU-only Llama 2 fallback (disabled)
│   ├── rebuild_vectorstore.py# Rebuild FAISS index from documents
│   ├── schema_migration.py   # DB migration helpers
│   ├── create_admin.py       # Create admin user script
│   ├── requirements.txt      # Python dependencies
│   ├── requirements-dev.txt  # Dev/test-only dependencies (pytest)
│   ├── core/
│   │   ├── config.py         # App config, env vars, DEBUG_MODE
│   │   └── rate_limiter.py   # slowapi rate limiter singleton
│   ├── routers/
│   │   ├── auth.py           # Login, register, JWT
│   │   ├── rag.py            # /ragAI endpoint (rate-limited)
│   │   ├── code_execution.py # /api/run-code (rate-limited)
│   │   └── ...               # Other routers
│   ├── services/
│   │   └── classroom_rag.py  # File validation, classroom RAG logic
│   ├── vectorstore/
│   │   ├── index.faiss       # FAISS binary (do not edit manually)
│   │   └── faiss_summary.json# Metadata for vectorstore entries
│   ├── evaluation/           # Model evaluation artifacts
│   ├── practical_tests/      # Practical test definitions
│   ├── tests/                # Tests (offline unit tests + E2E)
│   ├── scripts/              # Utility scripts
│   ├── java_docs/            # Java course documents (PDFs)
│   └── quiz_questions.csv    # Quiz data
│
├── docker-compose.yml        # Docker setup
├── startup.sh                # Azure startup script (repo root — Azure startup command)
│
├── frontend/                 # React app
│   └── src/
│       ├── classroomService.js
│       └── TeacherClassroomDetail.js
│
├── terminal-service/         # Node.js terminal microservice (child_process, no PTY)
│   └── server.js
│
└── public/                   # Static files (legacy, stays at root)
```

---

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- (Optional) Docker

### 1. Backend

```bash
# Create and activate virtual environment (at the repo root)
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt

# Set required environment variables (see below)
cp .env.example .env            # or set manually

# Run backend (development) — from backend/
cd backend
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
cd backend && python scripts/create_admin.py
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
cd backend && python scripts/rebuild_vectorstore.py
```

> ⚠️ Do not manually edit `backend/vectorstore/index.faiss`. Use `backend/vectorstore/extract_from_faiss.py` to inspect or rebuild metadata.

---

## Vectorstore / RAG Notes

- FAISS index stored at `backend/vectorstore/index.faiss`; metadata in `backend/vectorstore/faiss_summary.json`.
- Design intent: per-request retriever instances — **avoid module-level retriever singletons** (stale state). *Note: the current code does keep module-level singletons (`routers/rag.py`, set from `main.py`); tracked as BE-5 in [`docs/plans/active/codebase-audit.md`](docs/plans/active/codebase-audit.md).*
- See `rag_system.py` and `routers/rag.py` for the full RAG pipeline.
- NLI faithfulness checks validate that AI answers are grounded in retrieved documents.

---

## Interactive Terminal (dev & deploy)

The `terminal-service/` Node.js microservice compiles and runs Java programs that need stdin (e.g., `Scanner`). It uses plain `child_process` (`javac`/`java` via `execFile`/`spawn`) over a WebSocket — **not** node-pty (no PTY dependency exists in `terminal-service/package.json`).

### Local Dev — Convenience Script

Install `concurrently` and add to `frontend/package.json`:

```json
"scripts": {
  "dev:with-terminal": "concurrently \"node ../terminal-service/server.js\" \"npm start\" --names \"TERM,FRONT\" --kill-others-on-fail"
}
```

Then: `npm run dev:with-terminal`

### Production / Azure Notes

- No native binaries to rebuild (the old `npm rebuild node-pty` step is obsolete — there is no node-pty).
- In production, `startup.sh` launches the service in the background and the FastAPI backend proxies it at `/ws/terminal` (`routers/terminal.py`).
- Bind the service to `localhost` only — never expose it publicly without authentication. *Currently neither the service nor the proxy authenticates (audit SEC-1..6, critical — see owner item AUD-1 in [`docs/backlog.md`](docs/backlog.md)).*

---

## Developer Tips & Conventions

- **Router → Service pattern:** API handlers go in `routers/`, business logic in `services/`.
- **Rate limiting:** `/ragAI` — 30 req/min; `/api/run-code` — 20 req/min (via `slowapi`).
- **External integrations** (e.g., Paiza) rely on env vars in `core/config.py`.
- **Debug endpoints** (`/test-alive`, `/debug/routes`) are only registered when `DEBUG_MODE=true`.
- **File uploads:** intended max 50 MB, allowed types PDF, TXT, DOCX, DOC — *currently not enforced on the legacy upload route, and `MAX_UPLOAD_SIZE_BYTES` is never applied (audit SEC-20)*.

### Debug Mode

```bash
# Development (debug endpoints visible) — run from backend/
DEBUG_MODE=true uvicorn main:app --reload

# Production (debug endpoints return 404)
uvicorn main:app
```

---

## Known Issues & TODOs

> **Live tracker:** this table is a snapshot. The maintained list is [`docs/backlog.md`](docs/backlog.md) (items `KI-n` keep the numbering below); evidence and severity live in the verified audit, [`docs/plans/active/codebase-audit.md`](docs/plans/active/codebase-audit.md), and the 2026-10-22 analysis + improvement proposal in [`docs/reports/`](docs/reports/).

### 🔴 Phase 2 Fixes (Pending)

| # | Issue | File | Status |
|---|---|---|---|
| 1 | No password policy at all — no validator exists anywhere to "wire" (empty password accepted); one must be written (audit SEC-16) | `routers/auth.py` | ⏳ Pending |
| 2 | Generic 500 errors in some routers — need specific 4xx/5xx codes | `routers/*.py` | ⏳ Pending |
| 3 | No pagination on large query results (e.g., student lists) | `routers/` | ⏳ Pending |

### 🟡 Architecture / Improvement TODOs

| # | Issue | Notes |
|---|---|---|
| 4 | try/except + fallback already exist around `rag_chain()`; the real gap is a retrieval-only degradation mode when the LLM call itself fails (audit BE-22) | Handle LLM errors inside `chain_with_fallback` |
| 5 | `local_llm_fallback.py` (Llama 2 CPU) disabled — `OLLAMA_FALLBACK_ENABLED=False` | Enable post-FYP if local inference needed |
| 6 | `migrate_to_postgres.py` confirmed absent from the repo (audit BE-23) yet still listed in `.gitignore:47` | Owner: restore the script or drop the `.gitignore` line |
| 7 | The backend proxy for the terminal WebSocket exists (`/ws/terminal`, `routers/terminal.py`) but is unauthenticated, as is the service itself (audit SEC-1..6) | Owner decision AUD-1 |
| 8 | ~~No `.env.example` file~~ | ✅ Done 2026-10-22 — created as `env.example` (placeholders only); rename to `.env.example` pending (backlog OPS-2) |
| 9 | `quiz_questions.csv` committed to repo — may contain sensitive test data | Consider moving to seeded DB or protected storage |
| 10 | ~~Multiple loose `*.md` doc files in root~~ | ✅ Done 2026-10-22 — archived to [`docs/_archives/`](docs/_archives/README.md) (reorg Phase 2) |

### ✅ Completed Fixes (Phase 1 — April 2026)

> *Accuracy note (2026-10-22 audit): some of these claims no longer hold in full — logging is still mostly `print()` (GAP-6), the upload size/MIME checks are missing on the legacy route and `MAX_UPLOAD_SIZE_BYTES` is never enforced (SEC-20), and rate limiting covers RAG/code-exec but not login/register (SEC-14) and keys by a single proxy IP in production (SEC-15).*

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
