# syntax=docker/dockerfile:1
# CodeTutor backend container image — host-agnostic (deploy method DEPLOY-1 undecided).
# Build (from the repo root):   docker build -t codetutor-backend backend/
# Bake HF models into the image: docker build --build-arg BAKE_HF_MODELS=1 -t codetutor-backend backend/
# In container deployments this image replaces startup.sh (which stays at the
# repo root only because the latent zip workflows still reference it).
#
# Configuration is env-only — no secrets are baked into this image:
#   DATABASE_URL     required (no in-image default; without it the app falls back
#                    to SQLite inside the container and loses data on restart)
#   SECRET_KEY       required for auth (inert sentinel refuses to sign otherwise)
#   API_KEY          HKBU GenAI key (AI endpoints fail per-request without it)
#   PAIZA_API_KEY    optional (defaults to "guest")
#   CORS_ORIGINS     comma-separated allowlist; defaults to localhost dev origins
#   PORT             listen port (default 8000)
#   ENABLE_TERMINAL  deliberately NOT set — code default is off (AUD-1)
#   DEBUG_MODE       deliberately NOT set — code default is off

# Pinned Python base. Once Docker is available locally, pin the digest too:
#   docker inspect --format='{{index .RepoDigests 0}}' python:3.11-slim-bookworm
ARG PYTHON_BASE=python:3.11-slim-bookworm

# ---------- Stage 1: dependencies ----------
FROM ${PYTHON_BASE} AS deps
ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"
COPY requirements.txt /tmp/requirements.txt
# CPU-only torch: the extra index resolves the same pinned version as 2.2.2+cpu
# (PEP 440: ==2.2.2 matches 2.2.2+cpu), dropping ~3-4 GB of CUDA libraries the
# app never uses (LLM is an external API; embeddings/NLI run on CPU). On
# architectures without +cpu wheels (e.g. arm64) pip falls back to the regular
# PyPI wheel, which is already CPU-only there.
RUN pip install -r /tmp/requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu

# ---------- Stage 2: runtime ----------
FROM ${PYTHON_BASE} AS runtime

RUN useradd --create-home --uid 10001 codetutor

ENV PATH="/opt/venv/bin:${PATH}" \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/opt/hf-cache \
    TOKENIZERS_PARALLELISM=false

COPY --from=deps /opt/venv /opt/venv

WORKDIR /app
# .dockerignore keeps tests, caches and any .env* out of the context.
COPY . /app

# BAKE_HF_MODELS=1 downloads both startup models into the image's HF cache
# (all-MiniLM-L6-v2 ~90 MB + cross-encoder/nli-deberta-v3-small ~570 MB ≈
# +0.7 GB image size) so cold starts skip the Hugging Face download entirely.
# Default 0: smaller image, models fetched into /opt/hf-cache on first boot
# (needs egress; slower first start).
ARG BAKE_HF_MODELS=0
RUN mkdir -p /opt/hf-cache && \
    if [ "$BAKE_HF_MODELS" = "1" ]; then \
        python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')" && \
        python -c "from transformers import AutoTokenizer, AutoModelForSequenceClassification; AutoTokenizer.from_pretrained('cross-encoder/nli-deberta-v3-small'); AutoModelForSequenceClassification.from_pretrained('cross-encoder/nli-deberta-v3-small')"; \
    fi && \
    chown -R codetutor:codetutor /opt/hf-cache

USER codetutor
EXPOSE 8000

# /health is a plain liveness probe (main.py). start-period allows for the
# model/FAISS startup (60 s in-app timeout) plus a cold HF download when the
# models are not baked. slim has no curl; use the stdlib.
HEALTHCHECK --interval=30s --timeout=5s --start-period=180s --retries=5 \
    CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/health' % os.environ.get('PORT','8000'), timeout=4)"

# Single worker, matching the current gunicorn --workers 1 behaviour; scale via
# replicas on the (undecided) container host rather than in-process workers.
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
