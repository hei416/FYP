#!/bin/bash
# Azure App Service startup script for CodeTutor (FastAPI + React)
# CRITICAL: Never use 'exit 1' before gunicorn starts — Azure will treat it as worker failure
exec > >(tee -a /home/startup.log) 2>&1

echo "=========================================="
echo "  CodeTutor - Azure Startup $(date)"
echo "=========================================="

# Always work from the app directory
cd /home/site/wwwroot
echo "CWD: $(pwd)"
echo "FILES: $(ls -1 | head -20)"

# CRITICAL: Use ONLY Oryx's antenv — strip stale .python_packages from path
# .python_packages contains broken pydantic v1 that conflicts with antenv's pydantic v2
ANTENV_PATH=$(find /tmp -name "site-packages" -path "*/antenv/*" 2>/dev/null | head -1)
if [ -n "$ANTENV_PATH" ]; then
    export PYTHONPATH="$ANTENV_PATH"
    echo "✓ PYTHONPATH set to Oryx antenv: $PYTHONPATH"
else
    # Fallback: strip .python_packages from whatever Oryx already set
    export PYTHONPATH=$(echo "$PYTHONPATH" | tr ':' '\n' | grep -v '.python_packages' | tr '\n' ':' | sed 's/:$//')
    echo "⚠️ antenv not found, cleaned PYTHONPATH: $PYTHONPATH"
fi

echo "Python: $(which python) $(python --version)"
echo "Pydantic: $(python -c 'import pydantic; print(pydantic.__version__)' 2>/dev/null || echo 'NOT FOUND')"

# Verify core imports — warn only, never exit 1 before gunicorn
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

# Azure persistent storage for SQLite
export DATABASE_URL="${DATABASE_URL:-sqlite:////home/learning_platform.db}"
echo "DATABASE_URL type: ${DATABASE_URL%%:*}"

echo "[1/3] DB init skipped (lazy initialization)"
echo "[2/3] Seed skipped (lazy initialization)"

# Install Java in BACKGROUND — never block port binding with apt-get
echo "[3/3] Installing Java in background..."
(
    apt-get update -qq && apt-get install -y -qq default-jdk > /dev/null 2>&1 \
        && echo "✓ Java installed" \
        || (apt-get install -y -qq openjdk-11-jdk > /dev/null 2>&1 \
            && echo "✓ Java (openjdk-11) installed" \
            || echo "⚠️ Java installation skipped")
) &

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

# Start gunicorn — bind to port ASAP
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
