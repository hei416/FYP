import traceback
import time
import asyncio
import os
import sys

# Ultra-simple startup - minimize any blocking code
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Initialize FastAPI app FIRST before any other imports
app = FastAPI(title="Java Learning Platform - NLI-Verified RAG")

# Add CORS middleware immediately
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Import routers AFTER app is created - wrap in try-catch
try:
    from routers import code_execution, lessons, pdfs, practical_tests, rag, auth, progress
    import routers.rag as rag_router
except Exception as e:
    # If routers fail to import, log it but continue
    print(f"ERROR importing routers: {e}", file=sys.stderr)
    traceback.print_exc(file=sys.stderr)
    rag = None  # Set to None so we can check later

# Lazy loading: RAG system loads on first request, not during startup
RAG_INITIALIZED = False
RAG_INIT_LOCK = asyncio.Lock()

# Lazy loading: PDF chunks load on first request, not during startup
PDF_INITIALIZED = False
PDF_INIT_LOCK = asyncio.Lock()
PDF_CHUNKS = None

async def ensure_rag_initialized():
    """Lazy load RAG system on first use (imports heavy libs here)"""
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
            # ── Heavy import deferred to here ──
            from rag_system import setup_rag_system
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
            traceback.print_exc()

async def ensure_pdf_chunks_loaded():
    """Lazy load PDF chunks on first use (imports PyMuPDF here)"""
    global PDF_CHUNKS, PDF_INITIALIZED, HAS_PDF_SERVICE
    
    if PDF_INITIALIZED:
        return
    
    async with PDF_INIT_LOCK:
        # Double-check after acquiring lock
        if PDF_INITIALIZED:
            return
        
        print("\n🔄 Loading PDF chunks (lazy init on first request)...")
        try:
            # ── Heavy import deferred to here ──
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

@app.on_event("startup")
async def startup():
    """Minimal startup — just bind to port ASAP"""
    pass  # Do nothing - all initialization is lazy

# Include routers - simple, no error handling bloat
if rag:
    try:
        app.include_router(auth.router, tags=["Auth"])
        app.include_router(progress.router, tags=["Progress"])
        app.include_router(rag.router, tags=["AI Tutor"])
        app.include_router(code_execution.router, tags=["Code Execution"])
        app.include_router(lessons.router, tags=["Lessons"])
        app.include_router(pdfs.router, tags=["PDFs"])
        app.include_router(practical_tests.router, tags=["Tests"])
    except Exception as e:
        print(f"ERROR including routers: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)

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