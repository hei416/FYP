# First deployment readiness checklist

What must be true before the **first public deployment** of CodeTutor. Premise: owner states nothing has ever been live; CI history shows the pipelines last ran (failing) in April 2026 — see `docs/reports/deployment-evidence-2026-10-22.md`. Status values: **Done** / **Open** / **Needs owner**. IDs refer to `docs/plans/active/codebase-audit.md`; urgency rationale: the Reassessment section of `docs/reports/improvement-proposal-2026-10-22.md`.

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | **Azure inventory confirmed** — do `codetutor-fyp-hei`, `codetutor-frontend-hei`, `codetutor-rg`, the Postgres server and the GitHub secrets (`AZURE_CREDENTIALS`, `DATABASE_URL`, `SECRET_KEY`) still exist? Decide reuse vs recreate; check cost. | Needs owner (Azure half) | **GitHub half verified 2026-10-23**: all 5 secrets exist, Actions enabled, both workflows active — a matching push today **would** attempt a deploy. **Azure half still unverified**: `az` CLI is not installed on the dev machine; owner runs the read-only commands in `docs/reports/azure-inventory-2026-10-23.md` (Cloud Shell works). |
| 2 | **Why no CI run since 2026-04-22** investigated and fixed (Actions disabled? billing?) | **Done (explained 2026-10-23)** | Not a fault: Actions is enabled and the workflows active; the only push since 2026-04-22 (`23c472b`, 2026-10-22) touched only `README.md`, which matches neither path filter. CI is trustworthy-as-configured; the latent-deploy risk stands. See `docs/reports/azure-inventory-2026-10-23.md`. |
| 3 | **BE-1 credential**: rotate the Azure Postgres admin password (or confirm the server is deleted); history purge before the repo is ever shared/public | Needs owner — **urgent** | Code side Done (`fix/be1-credential-env` reads `PG_URL`/`DATABASE_URL` from env); the old value remains in git history — and the repo is **already public** (verified 2026-10-23), so the password is exposed now. If the server still exists (readiness #1), rotate or delete it same-day; commands in `docs/reports/azure-inventory-2026-10-23.md`. |
| 4 | **Secrets live only in Azure app settings / GitHub secrets** — `DATABASE_URL`, `SECRET_KEY`, `PAIZA_API_KEY`, HKBU GenAI key; nothing in code or zip. `env.example` documents the full set | Open | Verify against `core/config.py` env reads at deploy time; never commit `.env`. |
| 5 | **`ENABLE_TERMINAL` stays off** (unset/false in app settings); terminal-service not exposed; flag only ever enabled after SEC-2/3/5/6 hardening | Open | Gate present on this branch's lineage (`backend/core/config.py` / `routers/terminal.py`, verified 2026-10-23), default off. Remaining: leave the env var unset at deploy. Hard gate for deploy. |
| 6 | ~~**CI repair (AUD-2) reviewed and merged**~~ | **Dropped (superseded 2026-10-23)** | Owner dropped `c9e78c7` (the zip repair on `fix/terminal-and-ci`) — do not merge it. The zip pipeline itself is archived to `docs/_archives/2026-10-23_zip-deploy-workflows/`; replacement CI is readiness #17. FE-3/7/8/9/11 die with the zip pipeline; FE-10 is enforced by the new frontend workflow (TERMINAL_WS never set); FE-12 tracked as a comment in `deploy-frontend-pages.yml`. |
| 7 | **Pre-deploy security batch (AUD-3/4) merged** — SEC-7 teacher self-registration, SEC-8 CORS locked to the real frontend origin, SEC-9 no tracebacks to clients, SEC-10..13/21 auth on endpoints + SSRF proxy, SEC-14/16 login rate limit + password policy, FE-4 XSS sanitisation, FE-13 `python-multipart` bump | Open | This set defines whether a first deployment is safe at all. |
| 8 | **DB migration plan** — fresh Postgres bring-up order (`schema_migration.py` with env DSN), BE-2 dialect gating + BE-3 fail-loudly fixed first, admin seeding (`create_admin.py`) with a non-default password, backup/restore story | Open | BE-2/3 are AUD-5 (Ready, unmerged). First deploy runs migrations on an empty DB. |
| 9 | **Health check verified** — `/health` returns 200 on the new build; CI poll (post-AUD-2) gates the deploy | Open | Manual curl after first deploy + CI poll. |
| 10 | **Vector store loading verified on Azure** — committed FAISS stores load within startup timeouts (`main.py` lifespan executor); cold-start time measured | Open | The stores are committed precisely for this; verify once, document the timing. |
| 11 | **Frontend build vars correct** — `REACT_APP_API_BASE` points at the real backend URL; `REACT_APP_TERMINAL_WS` deliberately unset while terminal is off (FE-10); `frontend/.env.*` confirmed URL-only (SEC-ENV) | Needs owner | Agents must not read `frontend/.env.*`; owner inspects. CRA vars are build-time. |
| 12 | **Rollback plan written** — tag before each deploy; one-command revert to the previous ACA revision / image tag; Pages deploy history for the frontend | **Done (2026-10-23)** | Written: OPS.md §Deploy runbook → Rollback (ACA traffic-shift one-liner, `sha-*` image tags, CF Pages deployment history, `pg_dump` before migrations). |
| 13 | **`DEBUG_MODE` off in app settings** (debug endpoints unregistered) | Open | README documents the flag; verify at deploy. |
| 14 | **Smoke test script agreed** — login, RAG question, classroom page, code run (Paiza path) on the deployed URL | Open | Reuse OPS.md manual smoke test + `tests/` E2E where possible. |

Owner lifts the no-push rule only when every row is Done or explicitly accepted. Until then: workflows stay latent, nobody pushes.

## Deployment method (new, 2026-10-22 — decide before CI work)

Options research: [`docs/reports/deploy-options-2026-10-22.md`](../../reports/deploy-options-2026-10-22.md). Recommended default: **container image (ghcr.io) on Azure Container Apps, scale-to-zero (~$0–10/mo) + static frontend hosting (Cloudflare Pages or Azure SWA, $0) + Neon free Postgres**; runner-up Fly.io (~$3–8/mo, faster cold start, leaves Azure). The current zip-deploy pipeline is the thing the audit found broken — repairing it and replacing it are alternatives, not a sequence.

| # | Item | Status | Notes |
|---|---|---|---|
| 15 | **Deployment method chosen** (owner) — DEPLOY-1 | **Done (2026-10-23)** | Adopted: the report's recommended default — ghcr.io image → **Azure Container Apps** (scale-to-zero) + **Cloudflare Pages** frontend + **Neon** free Postgres. Decision-log entry **pending owner confirmation** of the proposed wording (see plan file `2026-10-23_deploy-pipeline_done.md`). |
| 16 | ~~**AUD-2 CI repair on hold**~~ | **Dropped (2026-10-23)** | Moot: owner dropped `c9e78c7`; zip pipeline archived (readiness #6). |
| 17 | Container method adopted: Dockerfile + `.dockerignore`, HF models bakeable, probe on `/health`, new build+push CI, secrets in platform store; `startup.sh` retired; `PROJECT_ROOT` fixed by the image layout. | Partly Done | Repo side Done (§Container readiness below). **New CI written 2026-10-23** on `ci/container-deploy-pipeline`: `build-backend-image.yml` (manual + `v*` tags → ghcr.io, SHA-tagged) and `deploy-frontend-pages.yml` (manual; API URL from the `REACT_APP_API_BASE` variable) — files only, nothing run. Still open: Docker smoke test (not run — no Docker locally), secrets/variables set in GitHub + ACA (owner), Neon/ACA/Pages provisioning (owner). Runbook: OPS.md §Deploy runbook. |

## Container readiness (2026-10-23, branch `integration/container-readiness` — pending owner review/merge)

Host-agnostic container prep done without choosing a host (DEPLOY-1/#15 still Needs owner). Runbook: `docs/OPS.md` §Container.

| Item | Status | Notes |
|---|---|---|
| `backend/Dockerfile` (multi-stage, non-root, pinned base, CPU-only torch, env-only config, no secrets) | **Done** | Image NOT built: Docker is not installed on the dev machine; exact commands in OPS.md §Container. Pin the base-image digest at first real build. |
| `backend/.dockerignore` (tests, caches, any `.env*` excluded; vectorstore/java_docs IN) | **Done** | |
| HF models bakeable into the image | **Done** | `--build-arg BAKE_HF_MODELS=1`, ≈ +0.7 GB (MiniLM ~90 MB + nli-deberta-v3-small ~570 MB); default off. |
| `/health` wired as container probe | **Done** | Dockerfile HEALTHCHECK, 180 s start period. |
| Local smoke test (image + throwaway Postgres) | **Commands documented** | `docker-compose.container.yml` (dev placeholders only); not run — no Docker locally. Run before first deploy. |
| Missing `sentence-transformers` pin (GAP-14) | **Done** | Container/manifest installs now get a working RAG. |
| SEC-14 login rate limit, SEC-16 password policy (rows #7 scope) | **Done on branch** | Offline-tested; readiness #7's remaining items were already on `refactor/backend-and-prebuild-fixes`. |
| FE-16 `npm test` green | **Done on branch** | Frontend test gate usable in any future CI. |
| transformers/torch bumps (FE-17 remainder) | Deferred | Unverifiable offline; revisit at first container build. |
| New build+push CI, platform secret store, host choice | CI **Done (files, 2026-10-23)**; secrets Needs owner | Host chosen (#15: ACA + CF Pages + Neon). New workflows on `ci/container-deploy-pipeline` replace the zip pair (archived). Secrets/variables (names in OPS.md §Deploy runbook) set by owner in GitHub + ACA; Azure half of #1 still unverified. |
