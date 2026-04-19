#!/bin/bash
# Azure App Service startup script for CodeTutor (FastAPI + React)
# CRITICAL: Never exit 1 or block before gunicorn binds to $PORT

echo "=========================================="
echo "  CodeTutor - Azure Startup $(date)"
echo "=========================================="

# Find where Oryx extracted the app — it's in /tmp, NOT /home/site/wwwroot
APP_DIR=$(find /tmp -name "main.py" 2>/dev/null | grep -v antenv | grep -v __pycache__ | head -1 | xargs dirname 2>/dev/null)
APP_DIR="${APP_DIR:-/home/site/wwwroot}"
cd "$APP_DIR"
echo "CWD: $(pwd)"
echo "FILES: $(ls -1 | head -20)"

# Try Oryx antenv in /tmp (server-side build), then fall back to
# GitHub Actions-built antenv in /home/site/wwwroot (CI build)
ANTENV_PATH=$(find /tmp -name "site-packages" -path "*/antenv/*" 2>/dev/null | head -1)
if [ -n "$ANTENV_PATH" ]; then
    export PYTHONPATH="$ANTENV_PATH"
    echo "✓ PYTHONPATH set to Oryx antenv (server-built): $PYTHONPATH"
else
    PY_VER=$(python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
    CI_ANTENV="/home/site/wwwroot/antenv/lib/python${PY_VER}/site-packages"
    if [ -d "$CI_ANTENV" ]; then
        export PYTHONPATH="$CI_ANTENV"
        echo "✓ PYTHONPATH set to CI-built antenv: $PYTHONPATH"
    else
        export PYTHONPATH=$(echo "$PYTHONPATH" | tr ':' '\n' | grep -v '.python_packages' | tr '\n' ':' | sed 's/:$//')
        echo "⚠️ No antenv found anywhere, cleaned PYTHONPATH: $PYTHONPATH"
    fi
fi

echo "Python: $(which python) $(python --version)"
echo "Pydantic: $(python -c 'import pydantic; print(pydantic.__version__)' 2>/dev/null || echo 'NOT FOUND')"

# Verify core imports — warn only, never exit 1
python -c "from fastapi import FastAPI; from sqlalchemy import create_engine; print('✓ Core imports OK')" || {
    echo "⚠️ WARNING: Core imports failed — gunicorn will report the real error"
    python -m pip freeze | grep -E "fastapi|pydantic|sqlalchemy" || true
}

# Verify practical_tests dependencies — warn only
echo "Checking practical_tests dependencies..."
python -c "import httpx; import requests; print('✓ practical_tests deps OK')" || {
    echo "⚠️ WARNING: practical_tests dependencies not found"
    python -m pip list | grep -E "httpx|requests" || true
}

# Azure persistent storage
export DATABASE_URL="${DATABASE_URL:-sqlite:////home/learning_platform.db}"
echo "DATABASE_URL type: ${DATABASE_URL%%:*}"

# Validate critical environment variables
STARTUP_ERROR=0
if [ -z "$SECRET_KEY" ]; then
    echo "❌ FATAL: SECRET_KEY environment variable is not set — auth routes will be misconfigured."
    STARTUP_ERROR=1
fi
if [ -z "$API_KEY" ]; then
    echo "⚠️ WARNING: API_KEY environment variable is not set — AI/RAG endpoints will fail at request time."
fi
if [ "${DATABASE_URL%%:*}" = "sqlite" ]; then
    echo "⚠️ WARNING: Using SQLite fallback — set DATABASE_URL to a Postgres URL for production."
fi
if [ "$STARTUP_ERROR" = "1" ]; then
    echo ">> Set the missing env vars in Azure App Service → Configuration → Application Settings"
fi

echo "[1/3] DB init skipped (lazy initialization)"
echo "[2/3] Seed skipped (lazy initialization)"
echo "[3/3] Java install skipped (not required)"

# Check practical_tests router — warn only, never block gunicorn
echo "Checking practical_tests router..."
python -c "from routers import practical_tests; print('✓ practical_tests router OK')" || {
    echo "❌ practical_tests import FAILED — printing traceback:"
    python -c "
import traceback
try:
    from routers import practical_tests
except Exception as e:
    traceback.print_exc()
" || true
}

# Start terminal service fully in background — MUST NOT block gunicorn startup
if [ -d "$APP_DIR/terminal-service" ]; then
    echo "Starting terminal-service in background from $APP_DIR/terminal-service"
    (cd "$APP_DIR/terminal-service" && npm install --no-audit --no-fund 2>/dev/null && node server.js 2>/dev/null) &
fi

# Start gunicorn from the correct app directory
echo "[4/4] Starting gunicorn on port ${PORT:-8000} from $APP_DIR..."
exec python -m gunicorn main:app \
    --workers 1 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind "0.0.0.0:${PORT:-8000}" \
    --chdir "$APP_DIR" \
    --timeout 120 \
    --graceful-timeout 30 \
    --access-logfile "-" \
    --error-logfile "-" \
    --log-level info
