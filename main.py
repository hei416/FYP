from dotenv import load_dotenv
load_dotenv()

import traceback
import time
import asyncio
import os
import sys

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = FastAPI(title="Java Learning Platform - NLI-Verified RAG")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

@app.get("/test-alive", tags=["Debug"])
async def test_alive():
    """Simple endpoint to verify backend reachability."""
    return {"status": "alive", "message": "Backend is reachable and custom endpoint is working."}

print("\n🔧 IMPORTING ROUTERS...")
try:
    from routers import code_execution
    print("  ✓ code_execution")
    from routers import lessons
    print("  ✓ lessons")
    from routers import pdfs
    print("  ✓ pdfs")
    from routers import practical_tests
    print("  ✓ practical_tests")
    from routers import rag
    print("  ✓ rag")
    from routers import auth
    print("  ✓ auth")
    from routers import progress
    print("  ✓ progress")
    from routers import my_work
    print("  ✓ my_work")
    from routers import conversation
    print("  ✓ conversation")
    from routers import classroom
    print("  ✓ classroom")
    import routers.rag as rag_router
    print("  ✓ rag_router\n")
    ROUTERS_IMPORTED = True
    print("✅ ALL ROUTERS IMPORTED SUCCESSFULLY\n")
except Exception as e:
    print(f"\n❌ ERROR importing routers: {e}", file=sys.stderr)
    traceback.print_exc(file=sys.stderr)
    ROUTERS_IMPORTED = False

RAG_INITIALIZED = False
RAG_INIT_LOCK = asyncio.Lock()
PDF_INITIALIZED = False
PDF_INIT_LOCK = asyncio.Lock()
PDF_CHUNKS = None

async def ensure_rag_initialized():
    global RAG_INITIALIZED
    if RAG_INITIALIZED:
        return
    async with RAG_INIT_LOCK:
        if RAG_INITIALIZED:
            return
        print("\n🔄 Loading FAISS RAG System (lazy init on first request)...")
        try:
            rag_start = time.time()
            from rag_system import setup_rag_system
            rag_chain, retriever = setup_rag_system(rebuild_vectorstore=False)
            rag_router.rag_chain = rag_chain
            rag_router.retriever = retriever
            rag_elapsed = time.time() - rag_start
            print(f"✅ FAISS RAG system loaded! ({rag_elapsed:.2f}s)")
            RAG_INITIALIZED = True
        except Exception as e:
            print(f"❌ FAISS RAG initialization failed: {e}")
            traceback.print_exc()

async def ensure_pdf_chunks_loaded():
    global PDF_CHUNKS, PDF_INITIALIZED, HAS_PDF_SERVICE
    if PDF_INITIALIZED:
        return
    async with PDF_INIT_LOCK:
        if PDF_INITIALIZED:
            return
        print("\n🔄 Loading PDF chunks (lazy init on first request)...")
        try:
            from services.pdf_service import extract_pdf_chunks
            pdf_start = time.time()
            PDF_CHUNKS = extract_pdf_chunks()
            pdf_elapsed = time.time() - pdf_start
            print(f"✅ Loaded {len(PDF_CHUNKS)} PDF documents ({pdf_elapsed:.2f}s)")
            PDF_INITIALIZED = True
        except Exception as e:
            print(f"⚠️ PDF loading warning: {e}")
            HAS_PDF_SERVICE = False
            PDF_CHUNKS = []
            PDF_INITIALIZED = True


def run_migrations(db_engine):
    """Quick manual migrations helper — run once at startup."""
    try:
        from sqlalchemy import text
        with db_engine.connect() as conn:
            # --- Existing migrations ---
            try:
                conn.execute(text("""
                    ALTER TABLE user_progress
                    ADD COLUMN IF NOT EXISTS dismissed_milestones TEXT[] DEFAULT '{}'
                """))
                conn.commit()
                print("✅ Migration: dismissed_milestones column ensured on user_progress")
            except Exception as e:
                print(f"⚠️ dismissed_milestones migration: {e}")

            # --- Role column on users ---
            try:
                conn.execute(text("""
                    ALTER TABLE users
                    ADD COLUMN IF NOT EXISTS role VARCHAR(50) NOT NULL DEFAULT 'student'
                """))
                conn.commit()
                print("✅ Migration: role column ensured on users")
            except Exception as e:
                print(f"⚠️ role migration: {e}")

            # --- Classrooms table ---
            try:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS classrooms (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
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
                print(f"⚠️ classrooms migration: {e}")

            # --- Classroom members table ---
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
                print(f"⚠️ classroom_members migration: {e}")

    except Exception as e:
        print(f"⚠️ run_migrations error: {e}")

@app.on_event("startup")
async def startup():
    """Minimal startup — run lightweight schema migrations."""
    try:
        from database import get_engine
        from sqlalchemy import text
        engine = get_engine()
        # Ensure ad-hoc migrations are applied (safe, idempotent)
        try:
            run_migrations(engine)
        except Exception:
            pass
        with engine.connect() as conn:
            # practical_test_questions helper columns
            for col, col_type in [
                ("base_helper_classes", "TEXT"),
                ("solution_helper_classes", "TEXT"),
            ]:
                try:
                    conn.execute(text(f"ALTER TABLE practical_test_questions ADD COLUMN {col} {col_type}"))
                    conn.commit()
                    print(f"✅ Migration: added column '{col}' to practical_test_questions")
                except Exception:
                    pass  # Column already exists

            # conversation_history table (PostgreSQL-compatible)
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
                print(f"⚠️ conversation_history migration: {e}")

            # conversation_summaries table (PostgreSQL-compatible)
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
                print(f"⚠️ quiz_attempts migration: {e}")

    except Exception as e:
        print(f"⚠️ Startup migration warning: {e}")

    routes = []
    for route in app.routes:
        if hasattr(route, "path") and hasattr(route, "methods"):
            routes.append(f"{', '.join(route.methods)} {route.path}")
    print("\n" + "="*60)
    print("📋 REGISTERED API ROUTES:")
    print("="*60)
    for route in sorted(routes):
        print(f"  {route}")
    print("="*60 + "\n")

if ROUTERS_IMPORTED:
    try:
        routers_to_include = [
            (auth.router, "Auth", None),
            (progress.router, "Progress", None),
            (rag.router, "AI Tutor", None),
            (code_execution.router, "Code Execution", None),
            (lessons.router, "Lessons", None),
            (pdfs.router, "PDFs", None),
            (practical_tests.router, "Tests", "/api/practical-tests"),
            (my_work.router, "My Work", None),
            (conversation.router, "Conversation", None),
            (classroom.router, "Classroom", None),
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
        print(f"\n✅ Router inclusion complete! Total routes: {len([r for r in app.routes if hasattr(r, 'path')])}\n")
    except Exception as e:
        print(f"ERROR including routers: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
else:
    print("⚠️ WARNING: Routers failed to import - API endpoints will not be available")

@app.get("/", tags=["Health"])
async def root():
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
        "features": ["AI Tutor", "Code Execution", "Lessons", "Exercises", "PDFs", "Conversation History", "Classroom"],
        "endpoints": {
            "ai_tutor": "POST /ragAI",
            "health": "GET /rag/health",
            "docs": "/docs"
        }
    }

@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok"}

@app.get("/debug/routes", tags=["Debug"])
async def debug_routes():
    routes = []
    for route in app.routes:
        if hasattr(route, "path") and hasattr(route, "methods"):
            routes.append({"path": route.path, "methods": list(route.methods)})
    return {"total_routes": len(routes), "routes": sorted(routes, key=lambda r: r["path"])}

@app.middleware("http")
async def catch_all_exceptions(request: Request, call_next):
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
