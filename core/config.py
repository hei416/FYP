import os

# Configuration
API_KEY = "aa1fd2a0-3cc8-4b6e-9491-e9602d0a2d30" # Hardcoded for testing
PAIZA_API_KEY = os.getenv("PAIZA_API_KEY", "guest")
LESSON_DIR = "/Users/hei/IdeaProjects/fyp/lessons_raw"
PDF_DIR = "/Users/hei/IdeaProjects/fyp/frontend/Lecture Notes-20250622"
JSON_PATH = "/Users/hei/IdeaProjects/fyp/oracle_java_tutorials_clean.json"
BASE_URL = "https://genai.hkbu.edu.hk/api/v0/rest"
BASE_PATH = "/Users/hei/IdeaProjects/fyp/practical_tests/set1/questions"
PDF_CHUNKS = None  # Will be initialized at startup
JSON_DATA = []     # Will be loaded at startup

# Model configuration
MODEL_API_VERSIONS = {
    "gpt-5-mini": "2024-12-01-preview",
    "gpt-5": "2024-12-01-preview",
    "gpt-4.1": "2024-12-01-preview",
    "gpt-4.1-mini": "2024-12-01-preview",
    "o1": "2024-12-01-preview",
    "o3-mini": "2024-12-01-preview",
}

MODEL_ENDPOINTS = {
    "gpt": "/chat/completions",
    "gemini": "/generate_content",
    "deepseek": "/chat/completions",
}

# Prompt templates
ROUTING_PROMPT = "Route queries to 'PDF' (Java concepts), 'JSON' (API/syntax), or 'Both'. Respond with one word."
COMPRESSION_PROMPT = "Condense Java-related information from context while preserving key facts. Remove irrelevant details."
ANSWER_PROMPT = "As a Java tutor, answer clearly for beginners using ONLY provided context. If context doesn't contain answer, say 'I don't know'."
VERIFICATION_PROMPT = "Check answers against context for: 1. Factual accuracy 2. Missing information 3. Hallucinations. Be specific about errors."
ARBITRATION_PROMPT = "Synthesize verified information into one beginner-friendly Java explanation. Use simple analogies and include short code examples where helpful."
