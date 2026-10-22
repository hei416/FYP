import os
from typing import List
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from core.config import PDF_DIR

router = APIRouter()

@router.get("/list-pdfs")
def list_pdfs() -> List[str]:
    try:
        return [f for f in os.listdir(PDF_DIR) if f.lower().endswith(".pdf")]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/pdf-files/{filename}")
def serve_pdf(filename: str):
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = os.path.join(PDF_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path=path, media_type="application/pdf")

