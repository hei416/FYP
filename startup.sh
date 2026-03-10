#!/bin/bash
# Azure App Service startup script for CodeTutor (FastAPI + React)
# CRITICAL: Azure kills the container if we don't bind to $PORT within ~230s
exec > >(tee -a /home/startup.log) 2>&1

echo "=========================================="
echo "  CodeTutor - Azure Startup $(date)"
echo "=========================================="

# Always work from the app directory
cd /home/site/wwwroot
echo "CWD: $(pwd)"
echo "FILES: $(ls -1 | head -20)"

# CRITICAL: Unset Azure's auto-injected PYTHONPATH IMMEDIATELY
# It points to .python_packages which may contain stale pydantic v1
unset PYTHONPATH

# Oryx builds in /tmp and doesn't preserve antenv after deployment
# Instead, rely on Oryx's pre-built Python being in PATH
echo "Python: $(which python) $(python --version)"
echo "Pydantic: $(python -c 'import pydantic; print(pydantic.__version__)' 2>/dev/null || echo 'NOT FOUND')"

# Verify we can import from current requirements
python -c "from fastapi import FastAPI; from sqlalchemy import create_engine; print('Core imports OK')" || {
  echo "ERROR: Core imports failed - checking pip freeze"
  python -m pip freeze | grep -E "fastapi|pydantic|sqlalchemy" || echo "Missing critical packages"
  exit 1
}

# Azure persistent storage for SQLite
export DATABASE_URL="${DATABASE_URL:-sqlite:////home/learning_platform.db}"
echo "DATABASE_URL type: ${DATABASE_URL%%:*}"

# Only run DB init/seed for SQLite (external DBs are pre-created and connection attempts are slow)
if echo "$DATABASE_URL" | grep -qi 'sqlite'; then
  echo "[1/3] SQLite detected — initialising database..."
  timeout 30 python -c "
import sys, os
os.environ['DATABASE_URL'] = 'sqlite:////home/learning_platform.db'
try:
    from sqlalchemy import create_engine
    from sqlalchemy.orm import declarative_base
    from db_models import User, UserProgress, QuizAttempt, TestAttempt, QuizQuestion
    
    # Direct engine creation for SQLite (don't use lazy loader at startup)
    engine = create_engine('sqlite:////home/learning_platform.db', connect_args={'check_same_thread': False})
    Base = declarative_base()
    Base.metadata.create_all(bind=engine)
    print('  DB tables ready.')
except Exception as e:
    print(f'  WARNING: DB init failed: {e}', file=sys.stderr)
    import traceback
    traceback.print_exc()
" || echo "WARNING: DB init timed out or failed (continuing anyway)"

  echo "[2/3] Seeding test account (if missing)..."
  timeout 30 python -c "
import sys, os
os.environ['DATABASE_URL'] = 'sqlite:////home/learning_platform.db'
try:
    import bcrypt
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from db_models import User
    
    # Direct session for SQLite (don't use lazy loader at startup)
    engine = create_engine('sqlite:////home/learning_platform.db', connect_args={'check_same_thread': False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    if not db.query(User).filter(User.email=='test@test.com').first():
        pwd = bcrypt.hashpw('test1234'.encode(), bcrypt.gensalt()).decode()
        db.add(User(email='test@test.com', password_hash=pwd, full_name='Test User'))
        db.commit()
        print('  Test account created.')
    else:
        print('  Test account already exists.')
    db.close()
except Exception as e:
    print(f'  WARNING: Seed failed: {e}', file=sys.stderr)
" || echo "WARNING: Seed timed out or failed (continuing anyway)"
else
  echo "[1/3] External DB detected — skipping DB init (handled by app startup)"
  echo "[2/3] External DB detected — skipping seed"
fi

# Start the application — bind to port ASAP so Azure health check passes
echo "[3/3] Starting gunicorn on port ${PORT:-8000}..."
exec python -m gunicorn main:app \
    --workers 1 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind "0.0.0.0:${PORT:-8000}" \
    --timeout 120 \
    --graceful-timeout 30 \
    --access-logfile "-" \
    --error-logfile "-" \
    --log-level info
