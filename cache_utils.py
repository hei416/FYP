from sqlalchemy.exc import IntegrityError
from models import RAGCache
from database import SessionLocal
from datetime import datetime
from typing import Optional
  # Adjust if defined elsewhere

def load_cache_stage(query: str, stage: str) -> Optional[str]:
    db = SessionLocal()
    try:
        cache = db.query(RAGCache).filter_by(query=query, stage=stage).first()
        return cache.result if cache else None
    finally:
        db.close()

def save_cache_stage(query: str, stage: str, result: str):
    db = SessionLocal()

    try:
        existing = db.query(RAGCache).filter_by(query=query, stage=stage).first()
        if existing:
            existing.result = result
            existing.timestamp = datetime.utcnow()
        else:
            new_entry = RAGCache(
                query=query,
                stage=stage,
                result=result,
                timestamp=datetime.utcnow()
            )
            db.add(new_entry)
        db.commit()
    except IntegrityError:
        db.rollback()
    finally:
        db.close()
