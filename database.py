from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from dotenv import load_dotenv

load_dotenv()

# Database URL
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./learning_platform.db")

# Lazy-load engine on first use to avoid connection timeouts at import time
_engine = None
_SessionLocal = None

def get_engine():
    """Lazily create and return the database engine"""
    global _engine
    if _engine is None:
        _engine = create_engine(
            DATABASE_URL,
            connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
            pool_pre_ping=True,  # Test connection before using
            echo=False
        )
    return _engine

def get_session_local():
    """Lazily create and return the session factory"""
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=get_engine())
    return _SessionLocal

# For backward compatibility, create properties that call the lazy loaders
@property
def engine():
    return get_engine()

@property  
def SessionLocal():
    return get_session_local()

# Expose engine and SessionLocal as module attributes
engine = None  # Will be set lazily

def _lazy_engine():
    global engine
    if engine is None:
        engine = get_engine()
    return engine

# Create a custom class to handle lazy loading
class LazyEngine:
    def __getattr__(self, name):
        return getattr(_lazy_engine(), name)

engine = LazyEngine()

SessionLocal = get_session_local

# Base for models
Base = declarative_base()

# Dependency for FastAPI
def get_db():
    db = get_session_local()()
    try:
        yield db
    finally:
        db.close()
