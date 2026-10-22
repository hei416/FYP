# Backlog

One task per entry. Keep this file under 150 lines — minor items are grouped. Seeded 2026-10-22 from the README "Known Issues & TODOs" table (KI-n keeps its numbering) and the verified read-only audit (`docs/plans/active/codebase-audit.md` — SEC/BE/FE/GAP IDs). Roadmap: `docs/reports/improvement-proposal-2026-10-22.md` (supersedes `enhancement-plan.md` phasing; see its **Reassessment** section for re-rated urgencies); analysis: `docs/reports/codebase-analysis-2026-10-22.md`. Premise update 2026-10-22: owner states nothing has ever been live (`docs/reports/deployment-evidence-2026-10-22.md`); deploy workflows are **latent but possibly armed** — the no-push rule stands, and security items are gated on `docs/plans/active/first-deploy-readiness.md` rather than burning live.

## Needs human (owner action, before code fixes)

- **[NL-1] Confirm/correct the deployment-history statement** — owner says "never deployed online", but CI shows 408 deploy runs with successes in Mar–Apr 2026, then zero since 2026-04-22 (evidence report). Owner to confirm the weaker reading ("never a working production instance"), answer the readiness checklist "Needs owner" rows (Azure inventory — GitHub half verified 2026-10-23, Azure half pending, see `docs/reports/azure-inventory-2026-10-23.md`; BE-1 rotation — **urgent, repo verified public**; `frontend/.env.*`; CI silence now explained — readiness #2 Done), and confirm the two proposed decision-log entries (incl. whether to re-open proposal decision #9, the `backend/` restructure, now cheap pre-first-deploy).

- **[PROP-1] Decide improvement option A / B / C** — **Decided 2026-10-22: Option B adopted** (decision log; `backend/` restructure stays propose-only). Unblocks AUD-3..7 batching per the proposal's phased roadmap.

- **[AUD-1] Terminal-service RCE decision** — **SUPERSEDED 2026-10-23: terminal-service deleted** (single-process collapse, decision log). SEC-1..6 are closed by removal, not by hardening; reintroducing any live-exec route re-opens them. *Historical:* decided 2026-10-22 as disable behind `ENABLE_TERMINAL` (default off), no code deleted — unauthenticated ws + file write + unsandboxed java (SEC-1..6/FE-1), runs in production via `startup.sh:88-90`. Implemented 2026-10-22 on branch `fix/terminal-and-ci` (gate in `core/config.py` + `routers/terminal.py`, offline test `tests/test_terminal_proxy.py`), pending owner merge; full hardening (SEC-2/3/5/6) stays in AUD-3. *Re-rated 2026-10-22 (not deployed): no live exposure today — now a hard first-deploy gate (readiness #5), not an emergency.*
- **[AUD-2] CI workflow fixes** — **approved 2026-10-22; partial fix prepared on `fix/terminal-and-ci` awaiting owner review**: backend.yml gains `terminal-service/**` (FE-2), drops stale `lessons_raw/**` (GAP-9) and `--async true` so the health poll validates the new build (FE-7); frontend.yml regenerates the deleted `server.js` at package time (FE-3 — repo untouched, zip layout unchanged). Still open: `**.py` over-match (FE-8), stale frontend filters `public/**`/`src/**` (FE-9), `REACT_APP_TERMINAL_WS` unset in build (FE-10), frontend sleeps/`--async`/restart race (FE-11), `CI: false` (FE-12). *Re-rated 2026-10-22: no live app to guard — pre-first-deploy gate (readiness #6); new blocker question: zero CI runs since 2026-04-22 (readiness #2).*
- **[KI-7] ~~Proxy terminal-service WebSocket through the backend in production~~** — **Closed 2026-10-23**: no WebSocket and no terminal-service left to proxy (single-process collapse).
- **[KI-9] `quiz_questions.csv` committed** — referenced by `db_models.py`, `routers/classroom.py`; owner decides seeded DB vs protected storage.
- **[SP-1] Remove `REACT_APP_TERMINAL_WS` from `frontend/.env.development` / `.env.production`** — dead after the 2026-10-23 single-process collapse. Agents must not read or edit `.env*` (hard rule 3), so the owner does this. Harmless if left (nothing reads it).

- **[SP-2] Make `backend/Dockerfile` carry `frontend/build`** — single-process mode serves the SPA from the backend process, so the image must contain the build (CI builds it; no Node at runtime). Currently the Dockerfile ships backend only and `docker-compose.container.yml` would run API-only. Batch with DEPLOY-1 — the pipeline work on `ci/container-deploy-pipeline` assumes a separate frontend host (Cloudflare Pages), which this decision may retire.

- **[SP-3] Drop the dead `terminal-service/**` filter from `.github/workflows/backend.yml`** — the folder no longer exists. Deliberately left alone: agents never edit CI (decision 2026-10-22) and the final shape waits on DEPLOY-1.

- **[SEC-ENV] Confirm `frontend/.env.*` (git-tracked) contain only public URLs** (SEC-22/FE-6); agents must not read them. If not URL-only: rotate, untrack, purge.
- **[DEPLOY-1] Choose the deployment method before any CI repair is merged** — research + comparison: `docs/reports/deploy-options-2026-10-22.md` (2026-10-22). Recommended default: container image on ghcr.io → Azure Container Apps scale-to-zero (~$0–10/mo) + static frontend (Cloudflare Pages / Azure SWA, $0) + Neon free Postgres; runner-up Fly.io. Depends on readiness #1 (Azure inventory). **While undecided, AUD-2's zip-pipeline repair on `fix/terminal-and-ci` stays on hold** (readiness #15/#16); a container choice needs a Dockerfile, baked HF models, and new build+push CI, and retires `startup.sh` (readiness #17).

## Ready (code fixes awaiting approval; backend deploy on push unless noted)

- **[AUD-3] Security batch (Phase 1 of enhancement plan)** — SEC-7 self-register-as-teacher, SEC-9/BE-4 tracebacks in 500s, SEC-8 CORS, SEC-10 file access, SEC-11/12/21 unauthenticated endpoints, SEC-13/BE-12 SSRF proxy, SEC-14/16 login limits + password policy (supersedes KI-1 — no validator exists to "wire"), SEC-2/3/5/6 terminal hardening.
- **[AUD-4] XSS: sanitize `dangerouslySetInnerHTML` sinks** — FE-4 (frontend deploy).
- **[AUD-5] Migration safety** — BE-2 dialect-gate Postgres-only SQL, BE-3 fail loudly instead of "✅ complete".
- **[AUD-6] Perf quick wins** — BE-8 per-chunk query, BE-11 blocking RAG call, BE-13 sleepless Paiza poll, BE-9/10 analytics N+1s, GAP-4 missing indexes (`SavedWork.user_id`, `ClassroomChunk.file_id`).
- **[KI-2] Specific 4xx/5xx instead of generic 500s** — 28 sites confirmed (BE-14/15).
- **[KI-3] Pagination on list endpoints** — 2 paginated vs 48 unbounded `.all()` in classroom.py (BE-7).
- **[KI-4] RAG degradation** — premise stale (BE-22): try/except + fallback exist; real gap is retrieval-only mode on LLM failure. (README wording fixed 2026-10-22.)
- **[OPS-1] Fix stale `core/config.py` defaults** — `LESSON_DIR` dead, `PDF_DIR` live and broken → `/pdfs` 500s (BE-16).
- **[AUD-7] Grouped med/low cleanups** — security: SEC-15/17/18/19/20/26/27; backend: BE-5/6/17/18/19/25; deps: FE-13/17/20, GAP-10 duplicate pin; frontend: FE-16/18/19 (frontend deploy); tests: FE-15 `dev-requirements.txt` + `pytest.ini` + first backend unit tests. Details in the audit doc.
- **[GAP-RAG] RAG quality** — unify the two divergent chunkers (GAP-2); eval golden set + methodology DONE 2026-10-22 (`docs/modules/rag-evaluation.md`); the runner `.py` still waits for AUD-2's CI fix (GAP-3).
- **[GAP-OBS] Logging instead of print** — 193 `print(` vs 5 loggers (GAP-6, extends BE-25); module loggers + request-id middleware; batch with AUD-6.
- **[GAP-FE] Frontend duplication** — shared `api.js` for the 18 duplicated API-base fallbacks (GAP-11); merge `TopicDetailPage`/`EnhancedTopicDetailPage` (GAP-12, halves the FE-4 sink surface). Frontend deploy.

## Waiting

- **[OPS-2] Rename `env.example` → `.env.example`** — blocked by the owner's user-level permission glob; owner runs `mv env.example .env.example` (closes KI-8 fully).
- **[AUD-8] Untrack `practical_tests/**/.DS_Store`** — tracked despite ignore rules (pre-existing); removal touches a backend CI filter path, so batch with a deploy-triggering commit.

## Unclear

- **[KI-6] `migrate_to_postgres.py`** — confirmed absent (BE-23); README reference corrected 2026-10-22. Owner still to restore the script or drop the stale `.gitignore:47` line.

## Parked

- **[AUD-0] Azure Postgres admin password rotation** — **deferred by owner decision 2026-10-22** (owner confirms no leak; value stays in use). *Re-rated under "not deployed": no live data believed at risk; rotation (or confirming the server is deleted) is readiness #3 — required before first deploy and before the repo is ever shared.* Code side DONE 2026-10-22: `schema_migration.py`/`verify_schema.py` now read `PG_URL`/`DATABASE_URL` from the environment. **The value remains in git history** — rotation + history purge still required before the repo is ever shared or made public. Owner also to set `PG_URL` wherever the scripts run, and may add a `PG_URL=` placeholder to `env.example`.

- **[KI-5] Local LLM fallback** (`local_llm_fallback.py`) — disabled; revisit post-FYP. Dead-code removal candidates alongside it: `verify_enhanced_support.py`, `verify_schema.py` (BE-24 — deletes, owner-gated).
- **[P2-public] Root `public/`** — owner 2026-10-22: leave in place (stale `frontend.yml` filter would fire).
- **[P2-bak] `frontend/src/TeacherClassroomDetail.js.bak`** — owner 2026-10-22: leave for now. Related: the live file is 3102 lines, the main refactor target (Phase 4).
- **[EXT] Extend-only items** — sandboxed Java execution (SEC-4), httpOnly-cookie auth (FE-5), Alembic (BE-21), CRA→Vite (FE-14), `backend/` restructure (propose-only move map in the improvement proposal — owner decision #9), staging slot + CI pytest gate (decision #10).
- **[GAP-OPP] Opportunistic refactors** — extract services from the 3121/2069-line routers (GAP-1), `/api` prefix convention (GAP-7), adopt `require_role()` everywhere (GAP-8), blob-size cap before storage rethink (GAP-5), worker-count review after BE-11/12 (GAP-13). Do only while touching the same files for other fixes.

## Done

- **[QW-1] Deploy-inert quick wins** — 2026-10-22: README aligned with the verified audit (node-pty claim removed, issues #1/#4/#6/#7/#8 corrected, upload/logging/rate-limit caveats, live-tracker link); RAG eval methodology + golden set in `docs/modules/rag-evaluation.md`.

- **[KI-8] `.env.example` placeholders** — created 2026-10-22 as `env.example` (see OPS-2 for the rename).
- **[KI-10] Loose root docs archived** — 2026-10-22, reorg Phase 2: 8 root report `*.md` + `QUICKSTART.md` (merged into `docs/OPS.md`) + `FYP RAG.ipynb` → `docs/_archives/` (see its README).
