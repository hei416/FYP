import traceback
import time
import asyncio
import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from routers import code_execution, lessons, pdfs, practical_tests, rag, auth, progress
from core.config import PDF_CHUNKS
from fastapi.responses import JSONResponse
from rag_system import setup_rag_system
import routers.rag as rag_router
from database import engine, Base
from db_models import User, UserProgress, QuizAttempt, TestAttempt, QuizQuestion, PracticalTestQuestion

# Note: Database tables will be created during startup, not at module import time



# For PDF service only (if it still exists)
try:
    from services.pdf_service import extract_pdf_chunks
    HAS_PDF_SERVICE = True
except Exception:
    print("⚠️ pdf_service unavailable, PDF features disabled")
    HAS_PDF_SERVICE = False

# Initialize FastAPI app
app = FastAPI(title="Java Learning Platform - NLI-Verified RAG")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Lazy loading: RAG system loads on first request, not during startup
RAG_INITIALIZED = False
RAG_INIT_LOCK = asyncio.Lock()

# Lazy loading: PDF chunks load on first request, not during startup
PDF_INITIALIZED = False
PDF_INIT_LOCK = asyncio.Lock()

async def ensure_rag_initialized():
    """Lazy load RAG system on first use"""
    global RAG_INITIALIZED
    
    if RAG_INITIALIZED:
        return
    
    async with RAG_INIT_LOCK:
        # Double-check after acquiring lock
        if RAG_INITIALIZED:
            return
        
        print("\n🔄 Loading FAISS RAG System (lazy init on first request)...")
        try:
            rag_start = time.time()
            rag_chain, retriever = setup_rag_system(rebuild_vectorstore=False)
            
            # Inject into rag router
            rag_router.rag_chain = rag_chain
            rag_router.retriever = retriever
            
            rag_elapsed = time.time() - rag_start
            print(f"✅ FAISS RAG system loaded! ({rag_elapsed:.2f}s)")
            print(f"   • Model: qwen3-max")
            print(f"   • NLI Faithfulness: 97.62% (46/47 claims)")
            print(f"   • Semantic Similarity: 80.78%")
            print(f"   • Context Recall: 74.21%")
            print(f"   • Avg Response Time: 6.73s")
            RAG_INITIALIZED = True
        except Exception as e:
            print(f"❌ FAISS RAG initialization failed: {e}")
            import traceback
            traceback.print_exc()

async def ensure_pdf_chunks_loaded():
    """Lazy load PDF chunks on first use"""
    global PDF_CHUNKS, PDF_INITIALIZED
    
    if PDF_INITIALIZED:
        return
    
    async with PDF_INIT_LOCK:
        # Double-check after acquiring lock
        if PDF_INITIALIZED:
            return
        
        if not HAS_PDF_SERVICE:
            PDF_INITIALIZED = True
            return
        
        print("\n🔄 Loading PDF chunks (lazy init on first request)...")
        try:
            pdf_start = time.time()
            PDF_CHUNKS = extract_pdf_chunks()
            pdf_elapsed = time.time() - pdf_start
            print(f"✅ Loaded {len(PDF_CHUNKS)} PDF documents ({pdf_elapsed:.2f}s)")
            PDF_INITIALIZED = True
        except Exception as e:
            print(f"⚠️ PDF loading warning: {e}")
            PDF_CHUNKS = []
            PDF_INITIALIZED = True

def refresh_knowledge_base():
    """Background task - currently empty, can add future refresh logic"""
    print("Background refresh check...")
    pass

@app.on_event("startup")
async def startup():
    global PDF_CHUNKS
    
    startup_start = time.time()
    print("="*70)
    print("🚀 STARTING JAVA LEARNING PLATFORM")
    print("="*70)
    
    # ============================================
    # [0/3] Initialize Database Tables
    # ============================================
    print("\n[0/3] Initializing database tables...")
    print("-"*70)
    db_start = time.time()
    try:
        Base.metadata.create_all(bind=engine)
        db_elapsed = time.time() - db_start
        print(f"✅ Database tables ready ({db_elapsed:.2f}s)")
    except Exception as e:
        print(f"⚠️ Database init warning: {e}")
    
    # ============================================
    # [1/3] RAG System: Lazy loading enabled
    # ============================================
    print("\n[1/3] RAG System: Lazy loading enabled (loads on first /ragAI request)")
    print("-"*70)
    print("⏸️  Skipping RAG init to speed up deployment")
    
    # ============================================
    # [2/3] Load PDF chunks (if service exists)
    # ============================================
    if HAS_PDF_SERVICE:
        print("\n[2/3] PDF Chunks: Lazy loading enabled (will load on first use)")
        print("-"*70)
        print("⏸️  Skipping PDF init to speed up deployment")
    else:
        print("\n[2/3] PDF service not available")
        PDF_CHUNKS = []
    
    # ============================================
    # [3/3] Starting background scheduler (DISABLED for deployment)
    # ============================================
    print("\n[3/3] Background scheduler: Disabled during Azure deployment")
    print("-"*70)
    # The scheduler will be started in local development but not in Azure
    # to avoid blocking the startup sequence
    # if HAS_BACKGROUND_SCHEDULER:
    #     try:
    #         scheduler = BackgroundScheduler()
    #         scheduler.add_job(refresh_knowledge_base, 'interval', hours=24)
    #         scheduler.start()
    #         print("✅ Background scheduler started")
    #     except Exception as e:
    #         print(f"⚠️ Scheduler warning: {e}")
    
    # Skip quiz cache pre-warming during deployment
    print("\n⏭️  Quiz cache pre-warming: Disabled during deployment")
    # asyncio.create_task(prewarm_quiz_cache())
    
    # ============================================
    # Startup Complete
    # ============================================
    total_elapsed = time.time() - startup_start
    print("\n" + "="*70)
    print(f"✅ JAVA LEARNING PLATFORM READY (total: {total_elapsed:.2f}s)")
    print("="*70)
    print("\n📚 Available Features:")
    print("   • AI Tutor (NLI-Verified RAG) → POST /ragAI")
    print("   • Code Execution              → POST /api/run-code")
    print("   • Lessons                     → /lessons/")
    print("   • Practical Tests             → /tests/")
    print("   • PDF Viewer                  → /pdfs/")
    print("\n📊 Performance Metrics:")
    print("   • NLI Faithfulness: 97.62%")
    print("   • Semantic Similarity: 80.78%")
    print("   • Context Recall: 74.21%")
    print("   • Response Time: 6.73s avg")
    print("\n🌐 Server: http://localhost:8000")
    print("📖 API Docs: http://localhost:8000/docs")
    print("="*70 + "\n")

# ============================================
# Background Cache Pre-warming
# ============================================
ALL_TOPICS = [
    "Bridging from Python",
    "Problem Solving with Java",
    "String",
    "Array",
    "Methods",
    "Exception Handling and File IO",
    "Class - constructor/attributes/methods",
    "Class - access modifier/static",
    "Inheritance",
    "Polymorphism",
    "Interface and Lambda expression",
    "Recursion and Revision",
]

async def prewarm_quiz_cache():
    """Pre-generate quizzes for common topic combos in the background."""
    # Disabled: get_cache function doesn't exist
    # from routers.rag import generate_mcq_quiz, QuizGenerateRequest, get_cache
    print("⏭️ Quiz cache pre-warming disabled (get_cache not implemented)")
    # Original code commented out:
    # # Progressive topic combos: first N topics as students unlock them
    # combos = []
    # for i in range(1, len(ALL_TOPICS) + 1):
    #     combos.append(ALL_TOPICS[:i])
    #
    # # 5 variations per combo
    # total = len(combos) * 5
    # generated = 0
    # skipped = 0
    #
    # print(f"\n🔥 Pre-warming quiz cache ({len(combos)} combos × 5 variations = {total} entries)...")
    # start = time.time()
    #
    # for combo in combos:
    #     for var in range(5):
    #         # Skip if already cached
    #         if get_cache(combo, var):
    #             skipped += 1
    #             continue
    #         try:
    #             req = QuizGenerateRequest(
    #                 completed_topics=combo,
    #                 num_questions=10,
    #                 variation_seed=var,
    #             )
    #             await generate_mcq_quiz(req)
    #             generated += 1
    #             print(f"  🔥 Warmed: {len(combo)} topics, var={var} ({generated} generated, {skipped} skipped)")
    #         except Exception as e:
    #             print(f"  ⚠️ Pre-warm failed ({len(combo)} topics, var={var}): {e}")
    #         # Small delay to avoid hammering the API
    #         await asyncio.sleep(1)
    #
    # elapsed = time.time() - start
    # print(f"✅ Cache pre-warm done: {generated} generated, {skipped} already cached ({elapsed:.1f}s)")


# Include routers
app.include_router(auth.router, tags=["Auth"])
app.include_router(progress.router, tags=["Progress"])
app.include_router(rag.router, tags=["AI Tutor"])
app.include_router(code_execution.router, tags=["Code Execution"])
app.include_router(lessons.router, tags=["Lessons"])
app.include_router(pdfs.router, tags=["PDFs"])
app.include_router(practical_tests.router, tags=["Tests"])

@app.get("/", tags=["Health"])
async def root():
    """Root endpoint with system info"""
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
        "features": ["AI Tutor", "Code Execution", "Lessons", "Tests", "PDFs"],
        "endpoints": {
            "ai_tutor": "POST /ragAI",
            "health": "GET /rag/health",
            "docs": "/docs"
        }
    }

@app.get("/health", tags=["Health"])
async def health_check():
    """Instant health check - used by Azure load balancer"""
    return {"status": "ok"}


@app.middleware("http")
async def catch_all_exceptions(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as e:
        print("=" * 60)
        print("🔴 UNHANDLED EXCEPTION:")
        traceback.print_exc()  # Full traceback to console
        print("=" * 60)
        return JSONResponse(
            status_code=500,
            content={"detail": str(e), "traceback": traceback.format_exc()}
        )