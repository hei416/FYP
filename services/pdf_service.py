import os
import fitz  # PyMuPDF
from typing import Dict, List, Any
from core.config import PDF_DIR
from core.utils import compress_text

def extract_pdf_chunks() -> Dict[str, List[str]]:
    pdf_chunks = {}
    for filename in os.listdir(PDF_DIR):
        if filename.lower().endswith(".pdf"):
            full_path = os.path.join(PDF_DIR, filename)
            try:
                doc = fitz.open(full_path)
                pdf_chunks[filename] = [page.get_text().strip() for page in doc]
            except Exception as e:
                print(f"Failed to extract {filename}: {e}")
    return pdf_chunks

def search_pdf_chunks(chunks: Dict[str, List[str]], query: str) -> (str, List[Dict[str, Any]]):
    matches = []
    context_snippets = []

    for fname, pages in chunks.items():
        for i, page in enumerate(pages):
            if query.lower() in page.lower():
                match = {
                    "file": fname,
                    "page": i + 1,
                    "snippet": page[:500]
                }
                matches.append(match)
                context_snippets.append(f"File: {fname}, Page {i+1}:{page[:500]}")
            if len(matches) >= 5:
                break

    context_text = "\n\n".join(context_snippets) or "No relevant PDF content found."
    context_text = compress_text(context_text, max_lines=30)
    return context_text, matches
