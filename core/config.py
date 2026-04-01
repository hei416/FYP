import os
# API Configuration
# ============================================
API_KEY = os.environ.get("API_KEY")
if not API_KEY:
	raise ValueError("API_KEY environment variable is not set. Please set it in your .env or environment.")
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

# ============================================
# FAISS RAG System Configuration
# ============================================
VECTORSTORE_ROOT = os.path.join(PROJECT_ROOT, "vectorstore")
DOCS_ROOT = os.path.join(PROJECT_ROOT, "java_docs")

# Legacy single-store layout retained for migration / recovery.
LEGACY_VECTORSTORE_PATH = VECTORSTORE_ROOT
DOCS_DIR = DOCS_ROOT

# Split knowledge-base layout.
VECTORSTORE_JAVA_PATH = os.path.join(VECTORSTORE_ROOT, "java_knowledge")
VECTORSTORE_PLATFORM_PATH = os.path.join(VECTORSTORE_ROOT, "platform_guide")
DOCS_JAVA_DIR = os.path.join(DOCS_ROOT, "java_knowledge")
DOCS_PLATFORM_DIR = os.path.join(DOCS_ROOT, "platform_guide")

# Backward-compatible alias for call sites still expecting the unified path.
VECTORSTORE_PATH = LEGACY_VECTORSTORE_PATH

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
