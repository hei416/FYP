import os
# API Configuration
# ============================================
API_KEY = "f55f10bc-9d4f-4751-b7d7-ac519834c8e8"
PAIZA_API_KEY = os.getenv("PAIZA_API_KEY", "guest")
BASE_URL = "https://genai.hkbu.edu.hk/api/v0/rest"

# ============================================
# Directory Paths (resolved relative to project root)
# ============================================
# Get project root early so it can be used below
_BASE_DIR_EARLY = os.path.dirname(os.path.abspath(__file__))  # /fyp/core
_PROJECT_ROOT_EARLY = os.path.dirname(_BASE_DIR_EARLY)         # /fyp

LESSON_DIR = os.getenv("LESSON_DIR", os.path.join(_PROJECT_ROOT_EARLY, "lessons_raw"))
PDF_DIR = os.getenv("PDF_DIR", os.path.join(_PROJECT_ROOT_EARLY, "frontend", "Lecture Notes-20250622"))
JSON_PATH = os.getenv("JSON_PATH", os.path.join(_PROJECT_ROOT_EARLY, "oracle_java_tutorials_clean.json"))
BASE_PATH = os.getenv("BASE_PATH", os.path.join(_PROJECT_ROOT_EARLY, "practical_tests", "set1", "questions"))
PDF_CHUNKS = None  # Will be initialized at startup
JSON_DATA = []     # Will be loaded at startup

# ============================================
# FAISS RAG System Configuration
# ============================================

# Get project root (fyp/) instead of core/
BASE_DIR = os.path.dirname(os.path.abspath(__file__))  # /fyp/core
PROJECT_ROOT = os.path.dirname(BASE_DIR)  # /fyp

# Vectorstore and docs are in PROJECT ROOT, not core/
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

# ============================================
# Model API Versions (Updated to Match Notebook)
# ============================================
MODEL_API_VERSIONS = {
    "qwen3-max": "v1",  # ← Changed
    "gpt-5-mini": "2024-12-01-preview",
    "gpt-5": "2024-12-01-preview",
    "gpt-4.1": "2024-12-01-preview",
    "gpt-4.1-mini": "2024-12-01-preview",
    "o1": "2024-12-01-preview",
    "o3-mini": "2024-12-01-preview",
    "text-embedding-3-small": "2024-05-01-preview",  # ← Changed
    "text-embedding-3-large": "2024-05-01-preview",
}

MODEL_ENDPOINTS = {
    "gpt": "/chat/completions",
    "gemini": "/generate_content",
    "deepseek": "/chat/completions",
    "embedding": "/embeddings",
}
