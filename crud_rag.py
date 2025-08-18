from sqlalchemy.orm import Session
from models import RAGCache
from datetime import datetime

def get_cached_result(db: Session, query: str, stage: str):
    return db.query(RAGCache).filter_by(query=query, stage=stage).first()

def save_to_cache(db: Session, query: str, stage: str, result: str, token_count: int = 0):
    cached = get_cached_result(db, query, stage)
    if cached:
        # Optionally update existing cache
        cached.result = result
        cached.timestamp = datetime.utcnow()
    else:
        cached = RAGCache(
            query=query,
            stage=stage,
            result=result,
        )
        db.add(cached)
    db.commit()
    db.refresh(cached)
    return cached
