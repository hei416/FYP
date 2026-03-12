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

# CRITICAL: Use ONLY Oryx's antenv — remove stale .python_packages from path
# .python_packages contains old/broken pydantic that conflicts with antenv
ANTENV_PATH=$(find /tmp -name "site-packages" -path "*/antenv/*" 2>/dev/null | head -1)
if [ -n "$ANTENV_PATH" ]; then
    export PYTHONPATH="$ANTENV_PATH"
    echo "✓ PYTHONPATH set to Oryx antenv: $PYTHONPATH"
else
    # Fallback: strip .python_packages, keep whatever Oryx already set
    export PYTHONPATH=$(echo "$PYTHONPATH" | tr ':' '\n' | grep -v '.python_packages' | tr '\n' ':' | sed 's/:$//')
    echo "⚠️ antenv not found, cleaned PYTHONPATH: $PYTHONPATH"
fi

echo "Python: $(which python) $(python --version)"
echo "Pydantic: $(python -c 'import pydantic; print(pydantic.__version__)' 2>/dev/null || echo 'NOT FOUND')"

# Verify core imports work with clean PYTHONPATH
python -c "from fastapi import FastAPI; from sqlalchemy import create_engine; print('✓ Core imports OK')" || {
    echo "ERROR: Core imports failed"
    python -m pip freeze | grep -E "fastapi|pydantic|sqlalchemy" || echo "Missing critical packages"
    exit 1
}

# Verify practical_tests dependencies
echo "Checking practical_tests dependencies..."
python -c "import httpx; import requests; print('✓ practical_tests deps OK')" || {
    echo "⚠️ WARNING: practical_tests dependencies not found"
    python -m pip list | grep -E "httpx|requests"
}

# Azure persistent storage for SQLite
export DATABASE_URL="${DATABASE_URL:-sqlite:////home/learning_platform.db}"
echo "DATABASE_URL type: ${DATABASE_URL%%:*}"

echo "[1/3] DB init skipped (lazy initialization)"
echo "[2/3] Seed skipped (lazy initialization)"

# Install Java (required for Java code execution)
echo "[3/3] Installing Java..."
apt-get update -qq && apt-get install -y -qq default-jdk > /dev/null 2>&1 || {
    echo "⚠️ WARNING: Java installation failed — attempting alternative..."
    apt-get install -y -qq openjdk-11-jdk > /dev/null 2>&1 || echo "⚠️ Java installation skipped"
}
javac -version 2>/dev/null && echo "✓ Java installed" || echo "⚠️ Java not available"

# Check if practical_tests imports cleanly before starting gunicorn
echo "Checking practical_tests router..."
python -c "from routers import practical_tests; print('✓ practical_tests router OK')" || {
    echo "❌ practical_tests import FAILED — printing traceback:"
    python -c "
import traceback
try:
    from routers import practical_tests
except Exception as e:
    traceback.print_exc()
"
}

echo "[4/4] Starting gunicorn on port ${PORT:-8000}..."
exec python -m gunicorn main:app \
    --workers 1 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind "0.0.0.0:${PORT:-8000}" \
    --timeout 120 \
    --graceful-timeout 30 \
    --access-logfile "-" \
    --error-logfile "-" \
    --log-level info
