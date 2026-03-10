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

# Activate the Oryx-created virtualenv
ANTENV="/home/site/wwwroot/antenv"
if [ -f "$ANTENV/bin/activate" ]; then
  echo "Activating Oryx virtualenv: $ANTENV"
  source "$ANTENV/bin/activate"
  # CRITICAL: Unset Azure's auto-injected PYTHONPATH which points to stale
  # .python_packages (may contain pydantic v1) and takes priority over antenv.
  unset PYTHONPATH
  echo "Python: $(which python) $(python --version)"
  echo "Pydantic: $(python -c 'import pydantic; print(pydantic.__version__)' 2>/dev/null || echo 'NOT FOUND')"
else
  echo "WARNING: antenv not found at $ANTENV, searching..."
  FOUND_ACTIVATE=$(find /home/site/wwwroot -name "activate" -path "*/bin/activate" 2>/dev/null | head -1)
  if [ -n "$FOUND_ACTIVATE" ]; then
    echo "Found virtualenv at: $FOUND_ACTIVATE"
    source "$FOUND_ACTIVATE"
    unset PYTHONPATH
    echo "Python: $(which python) $(python --version)"
    echo "Pydantic: $(python -c 'import pydantic; print(pydantic.__version__)' 2>/dev/null || echo 'NOT FOUND')"
  else
    echo "ERROR: No virtualenv found — using .python_packages as fallback"
    export PYTHONPATH="/home/site/wwwroot/.python_packages/lib/site-packages:$PYTHONPATH"
  fi
fi

# Azure persistent storage for SQLite
export DATABASE_URL="${DATABASE_URL:-sqlite:////home/learning_platform.db}"
echo "DATABASE_URL type: ${DATABASE_URL%%:*}"

# Only run DB init/seed for SQLite (external DBs are pre-created and connection attempts are slow)
if echo "$DATABASE_URL" | grep -qi 'sqlite'; then
  echo "[1/3] SQLite detected — initialising database..."
  timeout 30 python -c "
import sys
try:
    from database import get_engine, Base
    from db_models import User, UserProgress, QuizAttempt, TestAttempt, QuizQuestion
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    print('  DB tables ready.')
except Exception as e:
    print(f'  WARNING: DB init failed: {e}', file=sys.stderr)
" || echo "WARNING: DB init timed out or failed (continuing anyway)"

  echo "[2/3] Seeding test account (if missing)..."
  timeout 30 python -c "
import sys, os
os.environ.setdefault('DATABASE_URL', 'sqlite:////home/learning_platform.db')
try:
    import bcrypt
    from database import get_session_local
    from db_models import User
    db = get_session_local()()
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
