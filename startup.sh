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

# Skip DB init steps for now to minimize startup time
# The app can handle lazy DB initialization on first request
echo "[1/3] DB init skipped (lazy initialization)"
echo "[2/3] Seed skipped (lazy initialization)"

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
