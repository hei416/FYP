# First deployment readiness checklist

What must be true before the **first public deployment** of CodeTutor. Premise: owner states nothing has ever been live; CI history shows the pipelines last ran (failing) in April 2026 — see `docs/reports/deployment-evidence-2026-10-22.md`. Status values: **Done** / **Open** / **Needs owner**. IDs refer to `docs/plans/active/codebase-audit.md`; urgency rationale: the Reassessment section of `docs/reports/improvement-proposal-2026-10-22.md`.

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | **Azure inventory confirmed** — do `codetutor-fyp-hei`, `codetutor-frontend-hei`, `codetutor-rg`, the Postgres server and the GitHub secrets (`AZURE_CREDENTIALS`, `DATABASE_URL`, `SECRET_KEY`) still exist? Decide reuse vs recreate; check cost. | Needs owner | Unverifiable from the repo (API 403s). Also explains whether a push today would deploy. |
| 2 | **Why no CI run since 2026-04-22** investigated and fixed (Actions disabled? billing?) | Needs owner | Workflows show "active"; pushes matching filters fired nothing. CI cannot be trusted until explained. |
| 3 | **BE-1 credential**: rotate the Azure Postgres admin password (or confirm the server is deleted); history purge before the repo is ever shared/public | Needs owner | Code side Done (`fix/be1-credential-env` reads `PG_URL`/`DATABASE_URL` from env); the old value remains in git history. |
| 4 | **Secrets live only in Azure app settings / GitHub secrets** — `DATABASE_URL`, `SECRET_KEY`, `PAIZA_API_KEY`, HKBU GenAI key; nothing in code or zip. `env.example` documents the full set | Open | Verify against `core/config.py` env reads at deploy time; never commit `.env`. |
| 5 | **`ENABLE_TERMINAL` stays off** (unset/false in app settings); terminal-service not exposed; flag only ever enabled after SEC-2/3/5/6 hardening | Open | Gate implemented, default off, on `fix/terminal-and-ci` — **pending owner merge**. Hard gate for deploy. |
| 6 | **CI repair (AUD-2) reviewed and merged** — health poll validates the new build, frontend zip regenerates `server.js`, `terminal-service/**` filter added | Open | Prepared on `fix/terminal-and-ci`, awaiting owner review. Remaining CI items (FE-8/9/10/11/12) decided or accepted. |
| 7 | **Pre-deploy security batch (AUD-3/4) merged** — SEC-7 teacher self-registration, SEC-8 CORS locked to the real frontend origin, SEC-9 no tracebacks to clients, SEC-10..13/21 auth on endpoints + SSRF proxy, SEC-14/16 login rate limit + password policy, FE-4 XSS sanitisation, FE-13 `python-multipart` bump | Open | This set defines whether a first deployment is safe at all. |
| 8 | **DB migration plan** — fresh Postgres bring-up order (`schema_migration.py` with env DSN), BE-2 dialect gating + BE-3 fail-loudly fixed first, admin seeding (`create_admin.py`) with a non-default password, backup/restore story | Open | BE-2/3 are AUD-5 (Ready, unmerged). First deploy runs migrations on an empty DB. |
| 9 | **Health check verified** — `/health` returns 200 on the new build; CI poll (post-AUD-2) gates the deploy | Open | Manual curl after first deploy + CI poll. |
| 10 | **Vector store loading verified on Azure** — committed FAISS stores load within startup timeouts (`main.py` lifespan executor); cold-start time measured | Open | The stores are committed precisely for this; verify once, document the timing. |
| 11 | **Frontend build vars correct** — `REACT_APP_API_BASE` points at the real backend URL; `REACT_APP_TERMINAL_WS` deliberately unset while terminal is off (FE-10); `frontend/.env.*` confirmed URL-only (SEC-ENV) | Needs owner | Agents must not read `frontend/.env.*`; owner inspects. CRA vars are build-time. |
| 12 | **Rollback plan written** — tag before each deploy; documented revert + redeploy of previous tag; owner knows the manual App-Service restart path | Open | Pattern already sketched in the proposal roadmap; write it in OPS.md when first deploy is scheduled. |
| 13 | **`DEBUG_MODE` off in app settings** (debug endpoints unregistered) | Open | README documents the flag; verify at deploy. |
| 14 | **Smoke test script agreed** — login, RAG question, classroom page, code run (Paiza path) on the deployed URL | Open | Reuse OPS.md manual smoke test + `tests/` E2E where possible. |

Owner lifts the no-push rule only when every row is Done or explicitly accepted. Until then: workflows stay latent, nobody pushes.

## Deployment method (new, 2026-10-22 — decide before CI work)

Options research: [`docs/reports/deploy-options-2026-10-22.md`](../../reports/deploy-options-2026-10-22.md). Recommended default: **container image (ghcr.io) on Azure Container Apps, scale-to-zero (~$0–10/mo) + static frontend hosting (Cloudflare Pages or Azure SWA, $0) + Neon free Postgres**; runner-up Fly.io (~$3–8/mo, faster cold start, leaves Azure). The current zip-deploy pipeline is the thing the audit found broken — repairing it and replacing it are alternatives, not a sequence.

| # | Item | Status | Notes |
|---|---|---|---|
| 15 | **Deployment method chosen** (owner) — keep zip-deploy vs container on ACA / App Service / Fly / VPS; see report's top-2 + risks. Depends on #1 (do the Azure resources/credits still exist?) | Needs owner | Backlog DEPLOY-1. |
| 16 | **AUD-2 CI repair on `fix/terminal-and-ci` is ON HOLD** until #15 is decided — it patches the zip pipeline that a container choice replaces wholesale. Merge it only if the owner keeps zip-deploy. | Waiting | Readiness #6 inherits this hold. |
| 17 | If a container method is chosen: Dockerfile + `.dockerignore`, HF models baked into the image, probe on `/health`, new build+push CI, secrets in platform store; `startup.sh` retired (not deleted while the latent workflows exist); `PROJECT_ROOT` fixed by the image layout — makes the `backend/` restructure (proposal #9) cheap. | Open | Details: report §"What each option needs". |
