"""
Classroom RAG Service — DB-backed file storage + in-memory FAISS per classroom.

Files and their embeddings are stored in PostgreSQL (ClassroomFile / ClassroomChunk).
FAISS indices are built on first query and cached in memory; they are invalidated
whenever a file is uploaded or deleted.

NOTE: This replaces the old disk-based LangChain FAISS implementation.
The old helper functions (ingest_document, query_classroom_rag, delete_classroom_index)
are kept as thin compatibility shims so existing callers still work.
"""

import io
import numpy as np
from sqlalchemy.orm import Session
from db_models import ClassroomFile, ClassroomChunk
from models import HKBUEmbeddings
from core.config import API_KEY, BASE_URL, FAISS_EMBEDDING_MODEL, FAISS_EMBEDDING_API_VERSION

try:
    import faiss
    _FAISS_AVAILABLE = True
except ImportError:
    _FAISS_AVAILABLE = False

try:
    import fitz  # PyMuPDF
    _PYMUPDF_AVAILABLE = True
except ImportError:
    _PYMUPDF_AVAILABLE = False

try:
    import docx  # python-docx
    _DOCX_AVAILABLE = True
except ImportError:
    _DOCX_AVAILABLE = False


# ---------------------------------------------------------------------------
# Embedding helper — wraps the project's HKBUEmbeddings
# ---------------------------------------------------------------------------

_embedder = None

def _get_embedder() -> HKBUEmbeddings:
    global _embedder
    if _embedder is None:
        _embedder = HKBUEmbeddings(
            api_key=API_KEY,
            base_url=BASE_URL,
            model=FAISS_EMBEDDING_MODEL,
            api_version=FAISS_EMBEDDING_API_VERSION,
        )
    return _embedder


def _embed(text: str) -> list:
    return _get_embedder().embed_query(text)


# ---------------------------------------------------------------------------
# In-memory FAISS index cache  { classroom_id: (index, [chunk_text, ...]) }
# ---------------------------------------------------------------------------

_index_cache: dict = {}


# ---------------------------------------------------------------------------
# Text extraction
# ---------------------------------------------------------------------------

def _extract_text(filename: str, data: bytes) -> str:
    fname = filename.lower()
    if fname.endswith(".pdf"):
        if _PYMUPDF_AVAILABLE:
            doc = fitz.open(stream=data, filetype="pdf")
            return "\n".join(page.get_text() for page in doc)
        # Fallback: try to decode as text
        return data.decode("utf-8", errors="ignore")
    elif fname.endswith(".docx"):
        if _DOCX_AVAILABLE:
            document = docx.Document(io.BytesIO(data))
            return "\n".join(p.text for p in document.paragraphs if p.text.strip())
        return data.decode("utf-8", errors="ignore")
    else:
        return data.decode("utf-8", errors="ignore")


# ---------------------------------------------------------------------------
# Chunking
# ---------------------------------------------------------------------------

def _split_chunks(text: str, chunk_size: int = 500, overlap: int = 50) -> list:
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i: i + chunk_size])
        if chunk.strip():
            chunks.append(chunk)
        i += chunk_size - overlap
    return chunks


# ---------------------------------------------------------------------------
# Upload & Index  (new DB-backed approach)
# ---------------------------------------------------------------------------

def upload_and_index(
    classroom_id: int,
    filename: str,
    mime_type: str,
    raw_bytes: bytes,
    uploaded_by: int,
    db: Session,
) -> int:
    """
    1. Persist raw file bytes → classroom_files
    2. Extract text, chunk, embed
    3. Persist chunks + embeddings → classroom_chunks
    4. Bust in-memory FAISS cache for this classroom
    Returns: file_id
    """
    MAX_SIZE = 20 * 1024 * 1024  # 20 MB
    if len(raw_bytes) > MAX_SIZE:
        raise ValueError("File too large (max 20 MB)")

    # Persist file
    db_file = ClassroomFile(
        classroom_id=classroom_id,
        filename=filename,
        mime_type=mime_type,
        file_data=raw_bytes,
        uploaded_by=uploaded_by,
    )
    db.add(db_file)
    db.flush()  # populate db_file.id before inserting chunks

    # Extract → chunk → embed
    text = _extract_text(filename, raw_bytes)
    if not text.strip():
        db.commit()
        return db_file.id

    chunks = _split_chunks(text)
    embedder = _get_embedder()

    # Batch embed (16 per call)
    all_embeddings = []
    batch_size = 16
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i: i + batch_size]
        all_embeddings.extend(embedder.embed_documents(batch))

    # Persist chunks
    for chunk_text, emb in zip(chunks, all_embeddings):
        emb_bytes = np.array(emb, dtype=np.float32).tobytes()
        db.add(ClassroomChunk(
            file_id=db_file.id,
            classroom_id=classroom_id,
            chunk_text=chunk_text,
            embedding=emb_bytes,
        ))

    db.commit()
    _index_cache.pop(classroom_id, None)  # bust cache
    return db_file.id


# ---------------------------------------------------------------------------
# Delete file
# ---------------------------------------------------------------------------

def delete_classroom_file(file_id: int, classroom_id: int, db: Session) -> None:
    """
    Delete file row — classroom_chunks rows are CASCADE-deleted by the FK.
    Busts the in-memory FAISS cache.
    """
    db.query(ClassroomFile).filter(
        ClassroomFile.id == file_id,
        ClassroomFile.classroom_id == classroom_id,
    ).delete(synchronize_session=False)
    db.commit()
    _index_cache.pop(classroom_id, None)


# ---------------------------------------------------------------------------
# Build / retrieve in-memory FAISS index
# ---------------------------------------------------------------------------

def _get_or_build_index(classroom_id: int, db: Session):
    """
    Returns (faiss.IndexFlatIP, [chunk_texts]) for the classroom.
    Builds from Postgres when not cached.
    Returns (None, []) when classroom has no documents.
    """
    if classroom_id in _index_cache:
        return _index_cache[classroom_id]

    rows = (
        db.query(ClassroomChunk)
        .filter(ClassroomChunk.classroom_id == classroom_id)
        .all()
    )

    if not rows or not _FAISS_AVAILABLE:
        return None, []

    embeddings = np.array(
        [np.frombuffer(r.embedding, dtype=np.float32) for r in rows],
        dtype=np.float32,
    )
    faiss.normalize_L2(embeddings)

    dim = embeddings.shape[1]
    index = faiss.IndexFlatIP(dim)
    index.add(embeddings)

    chunk_texts = [r.chunk_text for r in rows]
    _index_cache[classroom_id] = (index, chunk_texts)
    return index, chunk_texts


# ---------------------------------------------------------------------------
# Search (RAG query)
# ---------------------------------------------------------------------------

def search_classroom_context(
    classroom_id: int,
    query: str,
    db: Session,
    top_k: int = 5,
) -> list:
    """
    Returns top_k most relevant chunk texts for the query.
    Returns [] when classroom has no uploaded documents or FAISS unavailable.
    """
    index, chunk_texts = _get_or_build_index(classroom_id, db)
    if index is None:
        return []

    query_emb = np.array([_embed(query)], dtype=np.float32)
    faiss.normalize_L2(query_emb)

    scores, ids = index.search(query_emb, top_k)
    results = []
    for score, idx in zip(scores[0], ids[0]):
        if idx != -1 and score > 0.3:
            results.append(chunk_texts[idx])
    return results


# ---------------------------------------------------------------------------
# Legacy compatibility shims (kept so routers/classroom.py still compiles)
# ---------------------------------------------------------------------------

def ingest_document(classroom_id: int, file_path: str, filename: str) -> int:
    """Legacy shim — reads file from disk and delegates to upload_and_index."""
    import os
    from database import SessionLocal
    db = SessionLocal()
    try:
        with open(file_path, "rb") as fh:
            raw_bytes = fh.read()
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
        mime_map = {"pdf": "application/pdf", "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "txt": "text/plain", "md": "text/markdown"}
        mime_type = mime_map.get(ext, "application/octet-stream")
        upload_and_index(
            classroom_id=classroom_id,
            filename=filename,
            mime_type=mime_type,
            raw_bytes=raw_bytes,
            uploaded_by=0,
            db=db,
        )
    finally:
        db.close()
    return 0


def query_classroom_rag(classroom_id: int, question: str, k: int = 5) -> list:
    """Legacy shim — searches classroom context and returns simple dicts."""
    from database import SessionLocal
    db = SessionLocal()
    try:
        chunks = search_classroom_context(classroom_id, question, db, top_k=k)
        return [{"page_content": c} for c in chunks]
    finally:
        db.close()


def delete_classroom_index(classroom_id: int) -> None:
    """Legacy shim — clears both DB chunks and the in-memory cache."""
    from database import SessionLocal
    db = SessionLocal()
    try:
        db.query(ClassroomChunk).filter(ClassroomChunk.classroom_id == classroom_id).delete()
        db.query(ClassroomFile).filter(ClassroomFile.classroom_id == classroom_id).delete()
        db.commit()
    finally:
        db.close()
    _index_cache.pop(classroom_id, None)
