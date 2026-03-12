import os
import fitz  # PyMuPDF
from typing import Dict, List
from core.config import PDF_DIR


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
