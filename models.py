from sqlalchemy import Column, String, Text, DateTime, func
from database import Base

class RAGCache(Base):
    __tablename__ = "rag_cache"
    query_hash = Column(String(32), primary_key=True)
    stage = Column(String(32), primary_key=True)
    content = Column(Text)
    created_at = Column(DateTime, default=func.now())