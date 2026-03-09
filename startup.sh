#!/bin/bash
# Azure App Service startup script for CodeTutor (FastAPI + React)

set -e

echo "=========================================="
echo "  CodeTutor - Azure Startup"
echo "=========================================="

# Activate the Oryx-created virtualenv (packages installed by pip during build)
ANTENV="/home/site/wwwroot/antenv"
if [ -f "$ANTENV/bin/activate" ]; then
  echo "Activating Oryx virtualenv: $ANTENV"
  source "$ANTENV/bin/activate"
else
  echo "WARNING: antenv not found at $ANTENV, using system Python"
fi

# Azure sets HOME=/home for persistent storage
# Store SQLite databases in /home so they survive restarts
export DATABASE_URL="sqlite:////home/learning_platform.db"

# Run DB migrations / create tables (idempotent)
echo "[1/3] Initialising database..."
python -c "
from database import engine, Base
from db_models import User, UserProgress, QuizAttempt, TestAttempt, QuizQuestion
Base.metadata.create_all(bind=engine)
print('  DB tables ready.')
"

# Seed the test account if it does not exist
echo "[2/3] Seeding test account (if missing)..."
python -c "
import os, sys
os.environ.setdefault('DATABASE_URL', 'sqlite:////home/learning_platform.db')
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
"

# Start the application
# Single worker required for SQLite (no concurrent writes across processes)
echo "[3/3] Starting uvicorn..."
exec gunicorn main:app \
    --workers 1 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind "0.0.0.0:${PORT:-8000}" \
    --timeout 120 \
    --access-logfile "-" \
    --error-logfile "-"
