from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from database import Base, engine
from services.pdf_service import extract_pdf_chunks
from services.rag_pipeline import load_json_data, build_tfidf_matrix
from routers import code_execution, lessons, pdfs, practical_tests, rag
from core.config import PDF_CHUNKS, JSON_DATA

# Initialize FastAPI app
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Create tables if not exist
Base.metadata.create_all(bind=engine)

def refresh_knowledge_base():
    print("Refreshing knowledge base...")
    load_json_data()
    if JSON_DATA:
        build_tfidf_matrix()

# Startup initialization
@app.on_event("startup")
def startup_event():
    global PDF_CHUNKS
    
    # Load PDF chunks
    PDF_CHUNKS = extract_pdf_chunks()
    print(f"Loaded {len(PDF_CHUNKS)} PDF documents")
    
    # Load JSON data
    load_json_data()
    
    # Build TF-IDF matrix
    if JSON_DATA:
        build_tfidf_matrix()
        print("Built TF-IDF matrix for JSON knowledge base")
    
    # Start background scheduler
    scheduler = BackgroundScheduler()
    scheduler.add_job(refresh_knowledge_base, 'interval', hours=24)
    scheduler.start()

# Include routers
app.include_router(rag.router)
app.include_router(practical_tests.router)
app.include_router(lessons.router)
app.include_router(pdfs.router)
app.include_router(code_execution.router)
