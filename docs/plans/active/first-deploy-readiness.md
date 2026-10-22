# First deployment readiness checklist

What must be true before the **first public deployment** of CodeTutor. Premise: owner states nothing has ever been live; CI history shows the pipelines last ran (failing) in April 2026 — see `docs/reports/deployment-evidence-2026-10-22.md`. Status values: **Done** / **Open** / **Needs owner**. IDs refer to `docs/plans/active/codebase-audit.md`; urgency rationale: the Reassessment section of `docs/reports/improvement-proposal-2026-10-22.md`.

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | **Azure inventory confirmed** — do `codetutor-fyp-hei`, `codetutor-frontend-hei`, `codetutor-rg`, the Postgres server and the GitHub secrets (`AZURE_CREDENTIALS`, `DATABASE_URL`, `SECRET_KEY`) still exist? Decide reuse vs recreate; check cost. | **Inventory Done 2026-10-23; reuse decision Needs owner (AZ-1)** | **GitHub half verified**: all 5 secrets exist, Actions enabled; both workflows since **manually disabled** (`disabled_manually`, 2026-10-23) — a push currently fires nothing, re-enabling re-arms. **Azure half now verified too**: everything still exists (`fyp-postgres-db` in `fyp-rg`; the two App Services + `codetutor-plan` in `codetutor-rg`; a second B1 plan `fyp-backend-plan`), but the **subscription is `Disabled`** so all of it is deactivated and **nothing is billing**. Reuse is impossible until the owner fixes billing — backlog **AZ-1**. Evidence: `docs/reports/azure-inventory-2026-10-23.md` §Azure (verified). |
| 2 | **Why no CI run since 2026-04-22** investigated and fixed (Actions disabled? billing?) | **Done (explained 2026-10-23)** | Not a fault: Actions is enabled and the workflows were active; the only push since 2026-04-22 (`23c472b`, 2026-10-22) touched only `README.md`, which matches neither path filter. CI is trustworthy-as-configured; the latent-deploy risk stands (workflows manually disabled 2026-10-23 — re-enabling re-arms). See `docs/reports/azure-inventory-2026-10-23.md`. |
| 3 | **BE-1 credential**: rotate the Azure Postgres admin password (or confirm the server is deleted); history purge before the repo is ever shared/public | Needs owner — **urgent** | Code side Done (`fix/be1-credential-env` reads `PG_URL`/`DATABASE_URL` from env); the old value remains in git history — and the repo is **already public** (verified 2026-10-23), so the password is exposed now. **Re-scoped 2026-10-23 (second pass):** the server **does** still exist, but the subscription is `Disabled` (AZ-1) so it is deactivated and the credential is **not exploitable today** — and rotation is impossible anyway (`ReadOnlyDisabledSubscription`). This becomes **same-day urgent the moment AZ-1 is resolved**: rotate the password *and* narrow the all-IPv4 firewall rule (**AZ-2**) before the server accepts traffic. Commands in `docs/reports/azure-inventory-2026-10-23.md`. |
| 4 | **Secrets live only in Azure app settings / GitHub secrets** — `DATABASE_URL`, `SECRET_KEY`, `PAIZA_API_KEY`, HKBU GenAI key; nothing in code or zip. `env.example` documents the full set | Open | Verify against `core/config.py` env reads at deploy time; never commit `.env`. |
| 5 | **`ENABLE_TERMINAL` stays off** (unset/false in app settings); terminal-service not exposed; flag only ever enabled after SEC-2/3/5/6 hardening | Open (deploy-time check) | Gate implemented, default off, **merged to main 2026-10-23**. Hard gate for deploy: keep the flag unset in app settings. |
| 6 | **CI repair (AUD-2) reviewed and merged** — health poll validates the new build, frontend zip regenerates `server.js`, `terminal-service/**` filter added | Open | Partial fix **merged to main 2026-10-23** (health poll, `server.js` regeneration, `terminal-service/**` filter). Remaining CI items (FE-8/9/10/11/12) open — and a container choice under DEPLOY-1 may retire the zip pipeline entirely. |
| 7 | **Pre-deploy security batch (AUD-3/4) merged** — SEC-7 teacher self-registration, SEC-8 CORS locked to the real frontend origin, SEC-9 no tracebacks to clients, SEC-10..13/21 auth on endpoints + SSRF proxy, SEC-14/16 login rate limit + password policy, FE-4 XSS sanitisation, FE-13 `python-multipart` bump | Mostly done | **Merged to main 2026-10-23.** Remaining: SEC-2/3/5/6 terminal hardening (terminal stays disabled — row 5) and SEC-13's async half (BE-12). |
| 8 | **DB migration plan** — fresh Postgres bring-up order (`schema_migration.py` with env DSN), BE-2 dialect gating + BE-3 fail-loudly fixed first, admin seeding (`create_admin.py`) with a non-default password, backup/restore story | Open | BE-2/3 (AUD-5) **merged to main 2026-10-23**; the bring-up order, admin seeding and backup story still need writing. First deploy runs migrations on an empty DB. |
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
| 17 | If a container method is chosen: Dockerfile + `.dockerignore`, HF models baked into the image, probe on `/health`, new build+push CI, secrets in platform store; `startup.sh` retired (not deleted while the latent workflows exist); `PROJECT_ROOT` fixed by the image layout — makes the `backend/` restructure (proposal #9) cheap. | Partly Done | Repo side Done 2026-10-23 (see §Container readiness below); still open: new CI (waits on #15) and secrets in the chosen host's store. |

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
| New build+push CI, platform secret store, host choice | Open / Needs owner | Blocked on #15 (and #1/#2); `.github/workflows/` untouched. |
