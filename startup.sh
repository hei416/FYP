#!/bin/bash
# Azure App Service startup script for CodeTutor (FastAPI + React)
# Log everything to /home/startup.log for diagnostics
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
  echo "Python: $(which python) $(python --version)"
else
  echo "WARNING: antenv not found at $ANTENV, searching..."
  FOUND_ACTIVATE=$(find /home/site/wwwroot -name "activate" -path "*/bin/activate" 2>/dev/null | head -1)
  if [ -n "$FOUND_ACTIVATE" ]; then
    echo "Found virtualenv at: $FOUND_ACTIVATE"
    source "$FOUND_ACTIVATE"
    echo "Python: $(which python) $(python --version)"
  else
    echo "ERROR: No virtualenv found! Packages may be missing."
    # Try to use system python with site-packages
    export PYTHONPATH="/home/site/wwwroot/.python_packages/lib/site-packages:$PYTHONPATH"
  fi
fi

# Azure persistent storage for SQLite
export DATABASE_URL="${DATABASE_URL:-sqlite:////home/learning_platform.db}"
echo "DATABASE_URL: $DATABASE_URL"

# Run DB migrations / create tables (idempotent)
echo "[1/3] Initialising database..."
python -c "
import sys
try:
    from database import engine, Base
    from db_models import User, UserProgress, QuizAttempt, TestAttempt, QuizQuestion
    Base.metadata.create_all(bind=engine)
    print('  DB tables ready.')
except Exception as e:
    print(f'  ERROR: DB init failed: {e}', file=sys.stderr)
    sys.exit(1)
" || { echo "ERROR: Database initialization failed!"; exit 1; }

# Seed the test account if it does not exist
echo "[2/3] Seeding test account (if missing)..."
python -c "
import sys
import os
os.environ.setdefault('DATABASE_URL', 'sqlite:////home/learning_platform.db')
try:
    import bcrypt
    from database import SessionLocal
    from db_models import User
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
    print(f'  ERROR: Seed failed: {e}', file=sys.stderr)
    sys.exit(1)
" || { echo "ERROR: Seed initialization failed!"; exit 1; }

# Start the application
echo "[3/3] Starting gunicorn on port ${PORT:-8000}..."
exec gunicorn main:app \
    --workers 1 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind "0.0.0.0:${PORT:-8000}" \
    --timeout 120 \
    --access-logfile "-" \
    --error-logfile "-"
