import os
import re
import fitz  # PyMuPDF
from typing import Dict, List
from core.config import PDF_DIR


def clean_pdf_chunk(text: str) -> str:
    """Apply lightweight post-processing to PDF-extracted text.

    - Remove hyphenation at line breaks
    - Remove common figure/table caption lines
    - Fix merged words like 'Theforloop' -> 'The for loop'
    - Normalize whitespace
    """
    if not text:
        return ""

    # Remove hyphenation at line breaks
    text = re.sub(r"-\s*\n\s*", "", text)

    # Remove figure/table captions (simple heuristics)
    text = re.sub(r'Figure\s*\d+(?:\.\d+)?[:\s][^\n]*\n?', '', text, flags=re.IGNORECASE)
    text = re.sub(r'Table\s*\d+(?:\.\d+)?[:\s][^\n]*\n?', '', text, flags=re.IGNORECASE)

    # Fix merged words by inserting space before capital letters following lowercase
    text = re.sub(r'([a-z])([A-Z])', r'\1 \2', text)

    # Normalize whitespace
    text = re.sub(r"\s+", " ", text).strip()

    return text


def extract_pdf_chunks() -> Dict[str, List[str]]:
    pdf_chunks = {}
    for filename in os.listdir(PDF_DIR):
        if filename.lower().endswith(".pdf"):
            full_path = os.path.join(PDF_DIR, filename)
            try:
                doc = fitz.open(full_path)
                pdf_chunks[filename] = [clean_pdf_chunk(page.get_text()) for page in doc]
            except Exception as e:
                print(f"Failed to extract {filename}: {e}")
    return pdf_chunks
