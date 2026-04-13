"""FastAPI Backend for Java Learning Platform with NLI-Verified RAG

This is the main entry point for the backend server. It sets up:
- FastAPI application with CORS middleware
- Router registration for all API endpoints
- Database migrations on startup (offloaded to thread pool)
- RAG system initialization for AI-powered tutoring (offloaded to thread pool)
- NLI monitor pre-warming (offloaded to thread pool)
"""

from dotenv import load_dotenv
load_dotenv()  # Load environment variables from .env file


# ============================================================================
# PYTORCH MPS WORKAROUND (macOS Apple Silicon)
# ============================================================================
# Must be set BEFORE importing torch/transformers to prevent segfaults on MPS
import os as _os
_os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"


import traceback
import time
import asyncio
import os
import sys
import logging
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor


# ============================================================================
# LOGGING CONFIGURATION
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Suppress verbose Uvicorn access logs (keep only WARNING+)
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from core.rate_limiter import limiter


# ============================================================================
# RAG SYSTEM STATE
# ============================================================================
# Global flag tracking whether FAISS RAG system has been initialized.
# Lock prevents concurrent initialization racing on first request.
RAG_INITIALIZED = False
RAG_INIT_LOCK = asyncio.Lock()

# Dedicated single-worker thread pool for all blocking startup tasks.
# max_workers=1 ensures migrations, NLI init, and RAG init run sequentially
# rather than concurrently — prevents shared resource conflicts (DB connections,
# model memory allocation, FAISS index writes).
_startup_executor = ThreadPoolExecutor(max_workers=1)


# ============================================================================
# ROUTER IMPORTS
# ============================================================================

logger.info("🔧 Importing routers...")
try:
    from routers import (
        code_execution, lessons, pdfs, practical_tests,
        rag, auth, progress, my_work, conversation,
        classroom, admin, terminal
    )
    import routers.rag as rag_router
    ROUTERS_IMPORTED = True
    logger.info("✅ All routers imported successfully")
except Exception as e:
    logger.error(f"❌ ERROR importing routers: {e}", exc_info=True)
    ROUTERS_IMPORTED = False


# ============================================================================
# DATABASE MIGRATIONS
# ============================================================================

def run_migrations(db_engine):
    """Run idempotent schema migrations. Safe to call multiple times.

    Called via run_in_executor at startup — SQLAlchemy's synchronous engine
    must never be called directly inside async def, as it holds thread-local
    connections internally and would block the event loop.
    """
    try:
        from sqlalchemy import text
        with db_engine.connect() as conn:

            # dismissed_milestones column on user_progress
            try:
                conn.execute(text("""
                    ALTER TABLE user_progress
                    ADD COLUMN IF NOT EXISTS dismissed_milestones JSON DEFAULT '[]'::JSON
                """))
                conn.commit()
                print("✅ Migration: dismissed_milestones column ensured on user_progress")
            except Exception as e:
                conn.rollback()
                print(f"⚠️ dismissed_milestones migration: {e}")

            # role column on users
            try:
                conn.execute(text("""
                    ALTER TABLE users
                    ADD COLUMN IF NOT EXISTS role VARCHAR(50) NOT NULL DEFAULT 'student'
                """))
                conn.commit()
                print("✅ Migration: role column ensured on users")
            except Exception as e:
                conn.rollback()
                print(f"⚠️ role migration: {e}")

            # classrooms table
            try:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS classrooms (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        category VARCHAR(100) NOT NULL DEFAULT 'Official Lessons',
                        description TEXT,
                        class_code VARCHAR(20) UNIQUE NOT NULL,
                        teacher_id INTEGER NOT NULL REFERENCES users(id),
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                conn.commit()
                print("✅ Migration: classrooms table ready")
            except Exception as e:
                conn.rollback()
                print(f"⚠️ classrooms migration: {e}")

            # category column on classrooms
            try:
                conn.execute(text("""
                    ALTER TABLE classrooms
                    ADD COLUMN IF NOT EXISTS category VARCHAR(100) NOT NULL DEFAULT 'Official Lessons'
                """))
                conn.commit()
                print("✅ Migration: category column ensured on classrooms")
            except Exception as e:
                conn.rollback()
                print(f"⚠️ classroom category migration: {e}")

            # classroom_members table
            try:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS classroom_members (
                        id SERIAL PRIMARY KEY,
                        classroom_id INTEGER NOT NULL REFERENCES classrooms(id),
                        student_id INTEGER NOT NULL REFERENCES users(id),
                        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(classroom_id, student_id)
                    )
                """))
                conn.commit()
                print("✅ Migration: classroom_members table ready")
            except Exception as e:
                conn.rollback()
                print(f"⚠️ classroom_members migration: {e}")

            # classroom_documents table
            try:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS classroom_documents (
                        id SERIAL PRIMARY KEY,
                        classroom_id INTEGER NOT NULL REFERENCES classrooms(id),
                        uploaded_by INTEGER NOT NULL REFERENCES users(id),
                        filename VARCHAR(255) NOT NULL,
                        original_name VARCHAR(255) NOT NULL,
                        file_type VARCHAR(50) NOT NULL,
                        status VARCHAR(50) DEFAULT 'ready',
                        chunk_count INTEGER DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                conn.commit()
                print("✅ Migration: classroom_documents table ready")
            except Exception as e:
                conn.rollback()
                print(f"⚠️ classroom_documents migration: {e}")

            # practical_test_questions helper columns
            for col, col_type in [
                ("base_helper_classes", "TEXT"),
                ("solution_helper_classes", "TEXT"),
            ]:
                try:
                    conn.execute(text(
                        f"ALTER TABLE practical_test_questions ADD COLUMN {col} {col_type}"
                    ))
                    conn.commit()
                    print(f"✅ Migration: added column '{col}' to practical_test_questions")
                except Exception:
                    conn.rollback()  # Column already exists — reset transaction state

            # conversation_history table
            try:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS conversation_history (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL REFERENCES users(id),
                        conversation_id VARCHAR(255) NOT NULL,
                        turn_number INTEGER NOT NULL,
                        is_summarized BOOLEAN DEFAULT FALSE,
                        user_message TEXT NOT NULL,
                        assistant_response TEXT NOT NULL,
                        context_type VARCHAR(50) NOT NULL DEFAULT 'general',
                        code_snippet TEXT,
                        input_tokens INTEGER DEFAULT 0,
                        output_tokens INTEGER DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        summary_of_turns JSONB
                    )
                """))
                conn.commit()
                print("✅ Migration: conversation_history table ready")
            except Exception as e:
                conn.rollback()
                print(f"⚠️ conversation_history migration: {e}")

            # conversation_summaries table
            try:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS conversation_summaries (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL REFERENCES users(id),
                        conversation_id VARCHAR(255) NOT NULL,
                        turn_range_start INTEGER NOT NULL,
                        turn_range_end INTEGER NOT NULL,
                        num_original_turns INTEGER NOT NULL,
                        summary TEXT NOT NULL,
                        key_points JSONB,
                        original_input_tokens INTEGER DEFAULT 0,
                        original_output_tokens INTEGER DEFAULT 0,
                        summary_input_tokens INTEGER DEFAULT 0,
                        summary_output_tokens INTEGER DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                conn.commit()
                print("✅ Migration: conversation_summaries table ready")
            except Exception as e:
                conn.rollback()
                print(f"⚠️ conversation_summaries migration: {e}")

            # quiz_attempts table
            try:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS quiz_attempts (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL REFERENCES users(id),
                        quiz_id VARCHAR(255) NOT NULL,
                        score FLOAT NOT NULL,
                        answers JSONB,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                conn.commit()
                print("✅ Migration: quiz_attempts table ready")
            except Exception as e:
                conn.rollback()
                print(f"⚠️ quiz_attempts migration: {e}")

            # page_number column on classroom_chunks
            try:
                conn.execute(text("""
                    ALTER TABLE classroom_chunks
                    ADD COLUMN IF NOT EXISTS page_number INTEGER DEFAULT 1
                """))
                conn.commit()
                print("✅ Migration: page_number column ensured on classroom_chunks")
            except Exception as e:
                conn.rollback()
                print(f"⚠️ page_number migration: {e}")

            # classroom_sections table
            try:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS classroom_sections (
                        id SERIAL PRIMARY KEY,
                        classroom_id INTEGER NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
                        name VARCHAR(255) NOT NULL,
                        description TEXT,
                        "order" INTEGER DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                conn.commit()
                print("✅ Migration: classroom_sections table ready")
            except Exception as e:
                conn.rollback()
                print(f"⚠️ classroom_sections migration: {e}")

            # section_id column on classroom_files
            try:
                conn.execute(text("""
                    ALTER TABLE classroom_files
                    ADD COLUMN IF NOT EXISTS section_id INTEGER
                        REFERENCES classroom_sections(id) ON DELETE SET NULL
                """))
                conn.commit()
                print("✅ Migration: section_id column ensured on classroom_files")
            except Exception as e:
                conn.rollback()
                print(f"⚠️ section_id migration: {e}")

    except Exception as e:
        print(f"⚠️ run_migrations error: {e}")


# ============================================================================
# RAG INITIALIZATION
# ============================================================================

def _blocking_rag_init(rebuild_java=False, rebuild_platform=False):
    """Pure synchronous RAG setup — safe to run in a thread.

    FAISS index loading, sentence-transformer embedding initialization, and
    LLM chain construction are all CPU/IO-bound. Running them in a thread
    via run_in_executor prevents the event loop from freezing.
    """
    from rag_system import setup_rag_system
    rag_chain, retriever = setup_rag_system(
        rebuild_java=rebuild_java,
        rebuild_platform=rebuild_platform,
    )
    return rag_chain, retriever


async def ensure_rag_initialized(rebuild_java=False, rebuild_platform=False):
    """Ensure FAISS RAG system is initialized. Thread-safe via async lock.

    Uses double-check locking pattern:
    1. Fast check outside lock (avoids lock contention on most calls)
    2. Acquire lock
    3. Re-check inside lock (guards against concurrent first-callers)
    4. Run blocking init in executor thread
    """
    global RAG_INITIALIZED

    if RAG_INITIALIZED and not rebuild_java and not rebuild_platform:
        return

    async with RAG_INIT_LOCK:
        # Re-verify after acquiring lock — another coroutine may have initialized
        # while we were waiting
        if RAG_INITIALIZED and not rebuild_java and not rebuild_platform:
            return

        if rebuild_java or rebuild_platform:
            targets = []
            if rebuild_java:
                targets.append("java knowledge")
            if rebuild_platform:
                targets.append("platform guide")
            print(f"\n🔄 Rebuilding FAISS RAG System ({', '.join(targets)})...")
        else:
            print("\n🔄 Loading FAISS RAG System...")

        try:
            rag_start = time.time()
            loop = asyncio.get_event_loop()

            # Dispatch blocking FAISS/embedding/LLM setup to thread pool.
            # run_in_executor with a lambda lets us pass keyword args cleanly.
            rag_chain, retriever = await loop.run_in_executor(
                _startup_executor,
                lambda: _blocking_rag_init(
                    rebuild_java=rebuild_java,
                    rebuild_platform=rebuild_platform
                )
            )

            # Store in rag router module for endpoint access
            rag_router.rag_chain = rag_chain
            rag_router.retriever = retriever

            elapsed = time.time() - rag_start
            print(f"✅ FAISS RAG system loaded! ({elapsed:.2f}s)")
            RAG_INITIALIZED = True

        except Exception as e:
            print(f"❌ FAISS RAG initialization failed: {e}")
            traceback.print_exc()


# ============================================================================
# LIFESPAN (replaces deprecated @app.on_event("startup"))
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown lifecycle.

    Everything before `yield` runs before the server accepts any requests.
    Everything after `yield` runs during graceful shutdown.

    Startup order (all blocking work offloaded to _startup_executor thread):
      1. DB migrations   — synchronous SQLAlchemy, must run in thread
      2. NLI monitor     — HuggingFace HTTP + model weight loading
      3. RAG system      — FAISS index + embedding model + LLM chain

    All three use the same single-worker executor to run sequentially,
    preventing concurrent DB connections and memory allocation conflicts.
    """
    loop = asyncio.get_event_loop()

    # ── Step 1: Database Migrations ─────────────────────────────────────────
    print("\n🗄️  Running database migrations...")
    try:
        from database import get_engine
        engine = get_engine()
        # SQLAlchemy sync engine dispatched to thread — never call it bare in async
        await loop.run_in_executor(_startup_executor, run_migrations, engine)
        print("✅ All migrations complete\n")
    except Exception as e:
        print(f"⚠️ Migration warning (server will still start): {e}\n")

    # ── Step 2: NLI Monitor Pre-warm ────────────────────────────────────────
    # Load DeBERTa weights now so the first student request isn't delayed
    # by model initialization AND so initialize() never runs inside async context
    print("🧠 Pre-warming NLI faithfulness monitor...")
    nli_monitor = None
    try:
        from services.nli_monitor import get_nli_monitor

        # Call get_nli_monitor() inside the startup executor so initialization
        # (which performs blocking HF/disk I/O) runs in a thread, not the event loop.
        nli_monitor = await loop.run_in_executor(_startup_executor, get_nli_monitor)
        print("✅ NLI monitor ready\n")
    except Exception as e:
        print(f"⚠️ NLI monitor init failed (will retry on first use): {e}\n")

    # ── Step 3: RAG System ──────────────────────────────────────────────────
    print("🔄 Eagerly initializing RAG system at startup...")
    try:
        await ensure_rag_initialized()
        print("✅ RAG system ready at startup!\n")
    except Exception as e:
        print(f"❌ RAG init failed (will retry on first request): {e}\n")

    # ── Print Registered Routes ─────────────────────────────────────────────
    routes = sorted(
        f"  {m} {r.path}"
        for r in app.routes
        if hasattr(r, 'path') and hasattr(r, 'methods')
        for m in (r.methods or [])
    )
    print("=" * 60)
    print("📋 REGISTERED API ROUTES:")
    print("=" * 60)
    print("\n".join(routes))
    print("=" * 60 + "\n")

    yield  # ← Server is live and accepting requests here

    # ── Shutdown Cleanup ────────────────────────────────────────────────────
    print("\n🛑 Shutting down — cleaning up thread pools...")
    _startup_executor.shutdown(wait=False)
    if nli_monitor is not None:
        nli_monitor._executor.shutdown(wait=False)
    print("✅ Shutdown complete")


# ============================================================================
# APP INITIALIZATION
# ============================================================================

app = FastAPI(
    title="Java Learning Platform - NLI-Verified RAG",
    lifespan=lifespan  # Replaces deprecated @app.on_event("startup")
)


# ============================================================================
# RATE LIMITING
# ============================================================================

app.state.limiter = limiter


def _rate_limit_error_handler(request: Request, exc: RateLimitExceeded):
    """Return 429 JSON response when a client exceeds their rate limit."""
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded. Please try again later."}
    )


app.add_exception_handler(RateLimitExceeded, _rate_limit_error_handler)


# ============================================================================
# CORS MIDDLEWARE
# ============================================================================
# Allows frontend (running on a different port) to make cross-origin requests.
# allow_origins=["*"] is acceptable during development; restrict in production.

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


# ============================================================================
# GLOBAL EXCEPTION MIDDLEWARE
# ============================================================================

@app.middleware("http")
async def catch_all_exceptions(request: Request, call_next):
    """Catch any unhandled exception from any route and return a 500 JSON response.

    Without this, unhandled exceptions bubble up as plain 500 HTML responses
    from Uvicorn, which the React frontend cannot parse as JSON.
    """
    try:
        return await call_next(request)
    except Exception as e:
        print("=" * 60)
        print("🔴 UNHANDLED EXCEPTION:")
        traceback.print_exc()
        print("=" * 60)
        return JSONResponse(
            status_code=500,
            content={"detail": str(e), "traceback": traceback.format_exc()}
        )


# ============================================================================
# ROUTER REGISTRATION
# ============================================================================

if ROUTERS_IMPORTED:
    try:
        routers_to_include = [
            (auth.router,            "Auth",           None),
            (progress.router,        "Progress",       None),
            (rag.router,             "AI Tutor",       None),
            (code_execution.router,  "Code Execution", None),
            (lessons.router,         "Lessons",        None),
            (pdfs.router,            "PDFs",           None),
            (practical_tests.router, "Tests",          "/api/practical-tests"),
            (my_work.router,         "My Work",        None),
            (conversation.router,    "Conversation",   None),
            (classroom.router,       "Classroom",      None),
            (admin.router,           "Admin",          None),
            (terminal.router,        "Terminal",       None),
        ]

        for router_obj, router_name, prefix in routers_to_include:
            try:
                if prefix:
                    app.include_router(router_obj, prefix=prefix, tags=[router_name])
                else:
                    app.include_router(router_obj, tags=[router_name])
                print(f"  ✓ {router_name} router included")
            except Exception as e:
                print(f"  ❌ {router_name} router FAILED: {e}", file=sys.stderr)
                traceback.print_exc(file=sys.stderr)

        total = len([r for r in app.routes if hasattr(r, 'path')])
        print(f"\n✅ Router inclusion complete! Total routes: {total}\n")

    except Exception as e:
        print(f"ERROR including routers: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
else:
    print("⚠️ WARNING: Routers failed to import — API endpoints will not be available")


# ============================================================================
# DEBUG ENDPOINTS (Development Only)
# ============================================================================

from core.config import DEBUG_MODE

if DEBUG_MODE:
    @app.get("/test-alive", tags=["Debug"])
    async def test_alive():
        """Verify backend reachability (dev only)."""
        return {"status": "alive", "message": "Backend is reachable."}

    @app.get("/debug/routes", tags=["Debug"])
    async def debug_routes():
        """List all registered API routes (dev only)."""
        routes = [
            {"path": r.path, "methods": list(r.methods)}
            for r in app.routes
            if hasattr(r, 'path') and hasattr(r, 'methods')
        ]
        return {"total_routes": len(routes), "routes": sorted(routes, key=lambda r: r["path"])}


# ============================================================================
# HEALTH CHECK ENDPOINTS
# ============================================================================

@app.get("/", tags=["Health"])
async def root():
    """Root endpoint — system status and performance metrics."""
    return {
        "status": "online",
        "system": "Java Learning Platform",
        "ai_model": "qwen3-max (FAISS + NLI Validation)",
        "performance": {
            "nli_faithfulness": "97.62%",
            "semantic_similarity": "80.78%",
            "context_recall": "74.21%",
            "avg_response_time": "6.73s",
            "claims_verified": "46/47"
        },
        "features": [
            "AI Tutor", "Code Execution", "Lessons",
            "Exercises", "PDFs", "Conversation History",
            "Classroom", "Admin"
        ],
        "endpoints": {
            "ai_tutor": "POST /ragAI",
            "health": "GET /rag/health",
            "docs": "/docs"
        }
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Quick liveness probe."""
    return {"status": "ok"}