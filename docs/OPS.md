# OPS — Runbook

One source of truth for running, testing, and understanding deploys. Agent rules live in [/AGENTS.md](../AGENTS.md).

## Local setup

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
pip install -r backend/requirements-dev.txt   # dev/test tools (pytest)
cp .env.example .env        # then fill in real values (never commit .env)
```

The Python backend lives in `backend/` (restructured 2026-10-22); backend commands below run from that directory.

Prerequisites: Python 3.10+, Node 18+, (optional) Docker.

## Running each service

| Service | Command | URL |
|---|---|---|
| Backend | `cd backend && uvicorn main:app --reload` | http://localhost:8000 (docs at `/docs`) |
| Frontend | `cd frontend && npm install && npm start` | http://localhost:3000 |
| Terminal service | `cd terminal-service && npm install && node server.js` | ws://localhost:3001 |
| All-in-one | `docker-compose up --build` | — |

Dev test account: `test@test.com` / `test1234` (recreate with `cd backend && python create_admin.py`).

## Tests

Offline unit tests live in `backend/tests/`; E2E still needs a running stack. What exists:

- **Offline suite** (FastAPI TestClient, no network, no running services) — run from `backend/`: `python -m pytest tests/ -q --ignore=tests/test_acceptance.py --ignore=tests/test_browser_compat.py --ignore=tests/locustfile.py`. Covers the `ENABLE_TERMINAL` gate (`test_terminal_proxy.py`) and the pre-first-deploy security fixes (`test_security_fixes.py`: registration role forcing, CORS config, traceback suppression, auth on conversations//explain-error/files, SSRF guard, SEC-14 login/register rate limit, SEC-16 password policy — 30 tests). Dependencies: `pip install -r backend/requirements-dev.txt`.
- `backend/tests/` (the rest) — pytest + Playwright E2E against a **running** localhost:3000 stack, plus a locustfile for load testing.
- `frontend/` — `CI=true npm test -- --watchAll=false` (react-scripts/jest; green since FE-16: react-router 7 needs the `moduleNameMapper` + TextEncoder polyfill already configured in `package.json`/`setupTests.js` — don't remove them).

Dev/test dependencies live in **`backend/requirements-dev.txt`** (pytest); the heavier E2E/load deps are still ad hoc (kept out deliberately — the deploy zip ships requirements.txt):

```bash
pip install playwright locust && playwright install
```

Fast verification used instead of a suite (run from `backend/`):

```bash
python -c "import main"               # app + all 13 routers import
python -c "from core import config"  # path config sanity
cd frontend && npm run build          # only when frontend changed (from the repo root)
```

### Manual smoke test — classroom description editing

Merged from the root `QUICKSTART.md` (original archived at `docs/_archives/QUICKSTART.md`). Needs backend + frontend running and a teacher login.

1. Teacher Dashboard → open an owned classroom; a description section shows below the class name/category badge ("No description yet…" when empty).
2. "✏️ Edit" → type a description → "✓ Save" → it displays; refresh the page → it persists.
3. Edit again and "✕ Cancel" → text reverts to the saved value.
4. DevTools Network check: saving sends `PATCH /classrooms/{id}` with body `{"description": "…"}` → 200.

Implementation: `frontend/src/classroomService.js` (`updateClassroom()`) + `frontend/src/TeacherClassroomDetail.js` (state + inline editor); backend PATCH endpoint pre-existed. Technical details: `docs/_archives/IMPLEMENTATION_SUMMARY.md`.

## Feature flags

- **`ENABLE_TERMINAL`** (env var, default **off**) — gates the backend `/ws/terminal` WebSocket proxy (`routers/terminal.py`; AUD-1 owner decision 2026-10-22 — the terminal-service it bridges to is unauthenticated and unsandboxed, audit SEC-1..6). When off, the WS handshake is rejected with HTTP 403 (close code 1008), so **the in-browser interactive Java terminal (Scanner/stdin) does not work in a deployed instance** (none is believed live — owner statement 2026-10-22): the frontend prints `[WebSocket error — retrying via HTTP]` and falls back to batch execution via Paiza (no interactive input). Set `ENABLE_TERMINAL=true` (an app-setting change restarts the app) only after the terminal service is hardened. Details and frontend behavior: [docs/modules/code-playground.md](modules/code-playground.md).

## Vector store rebuild (document only — do not run casually)

`cd backend && python rebuild_vectorstore.py` regenerates the FAISS stores in `backend/vectorstore/` (java_knowledge, platform_guide). The binaries are **committed on purpose** for fast startup — a rebuild changes tracked binaries; they ship inside the container image (and on the unmerged `main` a push would still hit the old zip pipeline's `backend/**` filter). Inspect metadata with `backend/vectorstore/extract_from_faiss.py`; never hand-edit `index.faiss`.

## Container (host-agnostic — deploy method DEPLOY-1 still undecided)

`backend/Dockerfile` builds a self-contained backend image (multi-stage, non-root, CPU-only torch, pinned `python:3.11-slim-bookworm`); it replaces `startup.sh` in any container deployment. **No host is chosen and nothing is deployed** — this works on ACA, Fly, a VPS, or App Service unchanged.

```bash
# Build (from the repo root). Docker is NOT installed on the current dev machine —
# these commands are written for whoever has Docker:
docker build -t codetutor-backend backend/
# Variant with both HF models baked in (image grows ~0.7 GB; cold starts skip the HF download):
docker build --build-arg BAKE_HF_MODELS=1 -t codetutor-backend backend/

# Local smoke test against a THROWAWAY Postgres (dev placeholders only — see file header):
docker compose -f docker-compose.container.yml up --build
curl -fsS http://localhost:8000/health                      # expect {"status":"ok"}
curl -fsS http://localhost:8000/openapi.json | python3 -c "import json,sys; print(len(json.load(sys.stdin)['paths']), 'paths')"
docker compose -f docker-compose.container.yml down -v      # discard the throwaway DB
```

`/health` (`backend/main.py`) is the container health/startup probe; the Dockerfile's HEALTHCHECK uses it with a 180 s start period (model load; longer on first boot without baked models).

**Backend env vars (placeholders only — real values live in the host's secret store, never in git or the image):**

| Var | Required | Placeholder example | Notes |
|---|---|---|---|
| `DATABASE_URL` | yes | `postgresql://USER:PASSWORD@HOST:5432/DB` (placeholder) | No in-image default; unset falls back to SQLite inside the container (data lost on restart) |
| `SECRET_KEY` | yes | `<long random string>` | JWT signing; unset = inert sentinel that refuses to sign |
| `API_KEY` | for AI features | `<HKBU GenAI key>` | AI endpoints fail per-request without it |
| `PAIZA_API_KEY` | no | `guest` | Code-execution fallback quota |
| `CORS_ORIGINS` | yes at deploy | `https://your-frontend.example` | Comma-separated allowlist (SEC-8); defaults to localhost dev origins |
| `PORT` | no | `8000` | Container listen port |
| `ENABLE_TERMINAL` | **leave unset** | — | AUD-1: default off; only after SEC-2/3/5/6 hardening |
| `DEBUG_MODE` | **leave unset** | — | Debug endpoints off by default |
| `PDF_DIR` / `LESSON_DIR` / `BASE_PATH` | no | — | Stale defaults (BE-16); override only if those features are used |
| `PROXY_ALLOWED_HOSTS` | no | `docs.oracle.com` | Extends the SSRF allowlist (SEC-13) |
| `MIGRATION_CONFIRM` | no | — | Only for deliberate `schema_migration.py` runs |

**Frontend container-era build option:** the frontend needs no container — `cd frontend && REACT_APP_API_BASE=https://YOUR-BACKEND.example npm run build` produces a static `build/` servable by any static host (or an nginx container). That removes the regenerated-`server.js` failure mode (FE-3) entirely; remember CRA env vars are build-time and `CORS_ORIGINS` must include the static origin.

**Not in the image:** `terminal-service/` (stays undeployed until SEC-1..6 hardening), `frontend/`, `docs/`, tests, any `.env*`. `startup.sh` is unused by the image; it stays at the repo root only until the old App Services are retired (the zip workflows that used it are archived on this branch but still live on `main`).

## Deploy runbook (container pipeline — DEPLOY-1, 2026-10-23; nothing provisioned yet)

Stack: backend image on **ghcr.io** → **Azure Container Apps** (consumption, scale-to-zero) · frontend static build → **Cloudflare Pages** · DB → **Neon** free Postgres. Decision-log entry pending owner confirmation. The old push-triggered zip pipelines are archived verbatim in [`docs/_archives/2026-10-23_zip-deploy-workflows/`](_archives/2026-10-23_zip-deploy-workflows/README.md) (the AUD-2 zip repair `c9e78c7` was dropped, never merged). **No workflow fires on push to `main`**: image builds run manually (Actions → *Build backend image*) or on a `v*` tag; the frontend deploy is manual-only. On `main` the old workflows are `disabled_manually` on GitHub (verified 2026-10-23; files still present there — re-enabling re-arms push-deploys until this branch merges; history: [reports/deployment-evidence-2026-10-22.md](reports/deployment-evidence-2026-10-22.md), inventory: [reports/azure-inventory-2026-10-23.md](reports/azure-inventory-2026-10-23.md)). Before the first deployment, work through [plans/active/first-deploy-readiness.md](plans/active/first-deploy-readiness.md).

### Secrets and variables (names only — values never in git)

| Where | Name | Used by |
|---|---|---|
| GitHub secret | `CLOUDFLARE_API_TOKEN` (scope: Account → Cloudflare Pages → Edit) | `deploy-frontend-pages.yml` |
| GitHub secret | `CLOUDFLARE_ACCOUNT_ID` | `deploy-frontend-pages.yml` |
| GitHub variable | `REACT_APP_API_BASE` (deployed backend URL; CRA = build-time) | frontend build |
| GitHub variable | `CF_PAGES_PROJECT` (Pages project name) | frontend deploy |
| ACA secret/env | `DATABASE_URL` (Neon), `SECRET_KEY`, `API_KEY`, `PAIZA_API_KEY` (optional), `CORS_ORIGINS` | backend runtime (full table: §Container) |
| ACA env | `ENABLE_TERMINAL`, `DEBUG_MODE` — **leave unset** | readiness #5/#13 |

ghcr.io auth in CI is the ephemeral `GITHUB_TOKEN` — no stored registry secret. Stale GitHub secrets once the old App Services are retired: `AZURE_CREDENTIALS`, `AZURE_WEBAPP_PUBLISH_PROFILE`, `AZURE_FRONTEND_PUBLISH_PROFILE` (and the GitHub-side `DATABASE_URL`/`SECRET_KEY` copies — no workflow reads them anymore; their real values live only in ACA).

### First deploy (owner, by hand — in this order)

1. **Neon**: create project + database; keep the connection string out of git. From a local shell, migrate the empty DB **by hand** (never CI): `DATABASE_URL=<neon url> MIGRATION_CONFIRM=yes python backend/schema_migration.py` (or `--yes`), then seed the admin with a non-default password: `python backend/create_admin.py` (readiness #8).
2. **Image**: run the *Build backend image* workflow (bake models = yes) or push a `v*` tag; note the pushed `sha-<fullsha>` tag. If the ghcr package is private, either make it public or give ACA a registry credential (PAT with `read:packages`).
3. **ACA**: create resource group + Containerapp environment + app — image `ghcr.io/hei416/codetutor-backend:sha-<sha>`, target port 8000, min replicas 0 / max 1, startup probe `GET /health` with ≥180 s allowance (first boot without baked models is slower), secrets/env from the table above, `CORS_ORIGINS=https://<project>.pages.dev` (plus any custom domain).
4. **Health check**: `curl -fsS https://<app>.<region>.azurecontainerapps.io/health` → `{"status":"ok"}`; then `/openapi.json` path count as in §Container.
5. **Cloudflare Pages**: create the Pages project (direct-upload); set repo variables `REACT_APP_API_BASE` = the ACA URL and `CF_PAGES_PROJECT`; run *Deploy frontend (Cloudflare Pages)*. `REACT_APP_TERMINAL_WS` stays unset (FE-10).
6. **Verify end-to-end**: open the Pages URL — login, one RAG question, classroom page, code run via Paiza (readiness #14); watch for CORS errors in the browser console.
7. Tag the deployed commit (`git tag deploy/YYYY-MM-DD`) so rollback has a named baseline (readiness #12).

### Rollback (one command)

- **Backend** — shift traffic back to the previous ACA revision (seconds, no rebuild): `az containerapp ingress traffic set -g <rg> -n <app> --revision-weight <previous-revision>=100` (list them: `az containerapp revision list -g <rg> -n <app> -o table`). Equivalent by image: `az containerapp update -g <rg> -n <app> --image ghcr.io/hei416/codetutor-backend:sha-<previous>`.
- **Frontend** — Cloudflare Pages keeps every deployment: dashboard → Deployments → previous → *Rollback*.
- **DB** — revisions only roll back code: take a manual `pg_dump` before every migration and keep schema changes backward-compatible with the previous revision, or the rollback lies.

### DB migrations after first deploy

Always by hand, never from CI: `pg_dump` first, then `MIGRATION_CONFIRM=yes python backend/schema_migration.py` with `DATABASE_URL` pointing at Neon, then health-check and smoke-test the running revision.

## Known failure patterns

- **`startup.sh` layout assumption** — on Azure it locates `main.py` by searching under `/tmp` at runtime (Oryx extraction + `antenv` venv dance). Updated 2026-10-22 for the `backend/` layout (the find resolves to `backend/`, wwwroot fallback is `/home/site/wwwroot/backend`, terminal-service launches from the repo dir above). **Unverified on Azure** — nothing is deployed; verify at first deploy.
- **Stale path defaults in `backend/core/config.py`** — `PDF_DIR` defaults to `frontend/Lecture Notes-20250622` (now doubly wrong: `PROJECT_ROOT` is `backend/`, which contains no `frontend/`) and `LESSON_DIR` to `lessons_raw`; **neither directory exists**. Both are env-overridable; code paths relying on the defaults fail quietly. (Backlog item BE-16.)
- **CRA env vars are build-time** — changing `REACT_APP_*` requires a rebuild/redeploy, not an app-settings change.
- **Terminal-service has no native binaries** — it uses plain `child_process` (there is no node-pty; the old `npm rebuild node-pty` Azure step is obsolete). Bind terminal-service to localhost only.
