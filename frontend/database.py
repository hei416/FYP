from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from dotenv import load_dotenv

load_dotenv()

# Database URL
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./learning_platform.db")

# Lazy-load engine on first use to avoid connection timeouts at import time
_engine = None
_session_local = None

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
    """Lazily create and return the session factory callable"""
    global _session_local
    if _session_local is None:
        _session_local = sessionmaker(autocommit=False, autoflush=False, bind=get_engine())
    return _session_local

# Proxy class for lazy SessionLocal access - maintains backward compatibility
class LazySessionLocal:
    """Callable proxy that returns a session on each call, lazily initializing the sessionmaker"""
    def __call__(self):
        return get_session_local()()

# Proxy object for lazy engine access
class LazyEngine:
    def __getattr__(self, name):
        return getattr(get_engine(), name)

# Module-level exports for backward compatibility
engine = LazyEngine()
SessionLocal = LazySessionLocal()  # Callable that returns sessions

# Base for models
Base = declarative_base()

# Dependency for FastAPI
def get_db():
    db = get_session_local()()
    try:
        yield db
    finally:
        db.close()
