from sqlalchemy import Column, Integer, String, Text, DateTime, UniqueConstraint
from database import Base
from datetime import datetime
class RAGCache(Base):
    __tablename__ = "rag_cache"

    id = Column(Integer, primary_key=True, index=True)
    query_hash = Column(String, nullable=False)
    stage = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)


    __table_args__ = (UniqueConstraint("query_hash", "stage", name="_query_stage_uc"),)
