from dotenv import load_dotenv
load_dotenv()

import traceback
import time
import asyncio
import os
import sys
import logging

# Suppress verbose Uvicorn access logs (keep only WARNING+)
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

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

print("\n🔧 Importing routers...")
try:
    from routers import code_execution, lessons, pdfs, practical_tests, rag, auth, progress, my_work, conversation, classroom, admin
    import routers.rag as rag_router
    ROUTERS_IMPORTED = True
    print("✅ All routers imported\n")
except Exception as e:
    print(f"\n❌ ERROR importing routers: {e}", file=sys.stderr)
    traceback.print_exc(file=sys.stderr)
    ROUTERS_IMPORTED = False

RAG_INITIALIZED = False
RAG_INIT_LOCK = asyncio.Lock()

async def ensure_rag_initialized(rebuild_java=False, rebuild_platform=False):
    global RAG_INITIALIZED
    if RAG_INITIALIZED and not rebuild_java and not rebuild_platform:
        return
    async with RAG_INIT_LOCK:
        if RAG_INITIALIZED and not rebuild_java and not rebuild_platform:
            return
        if rebuild_java or rebuild_platform:
            rebuild_targets = []
            if rebuild_java:
                rebuild_targets.append("java knowledge")
            if rebuild_platform:
                rebuild_targets.append("platform guide")
            print(f"\n🔄 Rebuilding FAISS RAG System ({', '.join(rebuild_targets)})...")
        else:
            print("\n🔄 Loading FAISS RAG System (lazy init on first request)...")
        try:
            rag_start = time.time()
            from rag_system import setup_rag_system
            rag_chain, retriever = setup_rag_system(
                rebuild_java=rebuild_java,
                rebuild_platform=rebuild_platform,
            )
            rag_router.rag_chain = rag_chain
            rag_router.retriever = retriever
            rag_elapsed = time.time() - rag_start
            print(f"✅ FAISS RAG system loaded! ({rag_elapsed:.2f}s)")
            RAG_INITIALIZED = True
        except Exception as e:
            print(f"❌ FAISS RAG initialization failed: {e}")
            traceback.print_exc()




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

            # --- Classroom documents table ---
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

            # page_number column for classroom_chunks (PDF page tracking)
            try:
                conn.execute(text("""
                    ALTER TABLE classroom_chunks
                    ADD COLUMN IF NOT EXISTS page_number INTEGER DEFAULT 1
                """))
                conn.commit()
                print("✅ Migration: page_number column ensured on classroom_chunks")
            except Exception as e:
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
                print(f"⚠️ section_id migration: {e}")

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
            (admin.router, "Admin", None),
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
        "features": ["AI Tutor", "Code Execution", "Lessons", "Exercises", "PDFs", "Conversation History", "Classroom", "Admin"],
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
