import hashlib
from typing import Optional
from sqlalchemy.orm import Session
from models import RAGCache

def load_cache_stage_db(query: str, stage: str, db: Session) -> Optional[str]:
    query_hash = hashlib.md5(query.encode()).hexdigest()
    record = db.query(RAGCache).filter_by(query_hash=query_hash, stage=stage).first()
    return record.content if record else None

def save_cache_stage_db(query: str, stage: str, content: str, db: Session):
    query_hash = hashlib.md5(query.encode()).hexdigest()
    existing = db.query(RAGCache).filter_by(query_hash=query_hash, stage=stage).first()
    if existing:
        existing.content = content
    else:
        db.add(RAGCache(query_hash=query_hash, stage=stage, content=content))
    db.commit()
