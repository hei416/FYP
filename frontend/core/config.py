import os
# API Configuration
# ============================================
API_KEY = "f55f10bc-9d4f-4751-b7d7-ac519834c8e8"
PAIZA_API_KEY = os.environ.get("PAIZA_API_KEY", "guest")
BASE_URL = "https://genai.hkbu.edu.hk/api/v0/rest"

# ============================================
# Project Root
# ============================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))  # /fyp/core
PROJECT_ROOT = os.path.dirname(BASE_DIR)               # /fyp

# ============================================
# Directory Paths
# ============================================
LESSON_DIR = os.getenv("LESSON_DIR", os.path.join(PROJECT_ROOT, "lessons_raw"))
PDF_DIR = os.getenv("PDF_DIR", os.path.join(PROJECT_ROOT, "frontend", "Lecture Notes-20250622"))
BASE_PATH = os.getenv("BASE_PATH", os.path.join(PROJECT_ROOT, "practical_tests", "set1", "questions"))
PDF_CHUNKS = None  # Will be initialized at startup

# ============================================
# FAISS RAG System Configuration
# ============================================
VECTORSTORE_PATH = os.path.join(PROJECT_ROOT, "vectorstore")
DOCS_DIR = os.path.join(PROJECT_ROOT, "java_docs")

# LLM Settings (MUST MATCH NOTEBOOK!)
FAISS_MODEL_NAME = "qwen3-max"
FAISS_API_VERSION = "v1"  # ← Changed from "2024-11-04"
FAISS_TEMPERATURE = 0.3
FAISS_MAX_TOKENS = 400

# Embedding Settings (MUST MATCH NOTEBOOK!)
FAISS_EMBEDDING_MODEL = "text-embedding-3-small"
FAISS_EMBEDDING_API_VERSION = "2024-05-01-preview"  # ← Changed from "2024-02-01"

# Retrieval Settings
CHUNK_SIZE = 600
CHUNK_OVERLAP = 150
K_DOCUMENTS = 3          # Number of documents to retrieve
FETCH_K = 15            # Candidate pool for MMR
LAMBDA_MULT = 0.7       # MMR diversity (0.7 = 70% relevance, 30% diversity)
