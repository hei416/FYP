# Backlog

One task per entry. Keep this file under 150 lines — minor items are grouped. Seeded 2026-10-22 from the README "Known Issues & TODOs" table (KI-n keeps its numbering) and the verified read-only audit (`docs/plans/active/codebase-audit.md` — SEC/BE/FE/GAP IDs). Roadmap: `docs/reports/improvement-proposal-2026-10-22.md` (supersedes `enhancement-plan.md` phasing; see its **Reassessment** section for re-rated urgencies); analysis: `docs/reports/codebase-analysis-2026-10-22.md`. Premise update 2026-10-22: owner states nothing has ever been live (`docs/reports/deployment-evidence-2026-10-22.md`); security items are gated on `docs/plans/active/first-deploy-readiness.md` rather than burning live. Update 2026-10-23: the fix branches (`fix/terminal-and-ci`, `fix/be1-credential-env`, `refactor/backend-and-prebuild-fixes`, `integration/container-readiness`, 17/19 Crit/High bug-audit fixes) are **merged to main**, and both deploy workflows are **manually disabled on GitHub** (`disabled_manually`) — pushes currently fire nothing, re-enabling re-arms them, and the no-push rule stands.

## Needs human (owner action, before code fixes)

- **[NL-1] Confirm/correct the deployment-history statement** — owner says "never deployed online", but CI shows 408 deploy runs with successes in Mar–Apr 2026, then zero since 2026-04-22 (evidence report). Owner to confirm the weaker reading ("never a working production instance"), answer the readiness checklist "Needs owner" rows (Azure inventory — GitHub half verified 2026-10-23, Azure half pending, see `docs/reports/azure-inventory-2026-10-23.md`; BE-1 rotation — **urgent, repo verified public**; `frontend/.env.*`; CI silence now explained — readiness #2 Done), and confirm the two proposed decision-log entries (incl. whether to re-open proposal decision #9, the `backend/` restructure, now cheap pre-first-deploy).

- **[PROP-1] Decide improvement option A / B / C** — **Decided 2026-10-22: Option B adopted** (decision log; `backend/` restructure stays propose-only). Unblocks AUD-3..7 batching per the proposal's phased roadmap.

- **[AUD-1] Terminal-service RCE decision** — **Decided 2026-10-22: disable the `/ws/terminal` proxy behind `ENABLE_TERMINAL` (default off), no code deleted** — unauthenticated ws + file write + unsandboxed java (SEC-1..6/FE-1), runs in production via `startup.sh:88-90`. Implemented 2026-10-22 (gate in `core/config.py` + `routers/terminal.py`, offline test `tests/test_terminal_proxy.py`), **merged to main 2026-10-23**; full hardening (SEC-2/3/5/6) stays in AUD-3. *Re-rated 2026-10-22 (not deployed): no live exposure today — now a hard first-deploy gate (readiness #5), not an emergency.*
- **[AUD-2] CI workflow fixes** — **approved 2026-10-22; partial fix merged to main 2026-10-23** (via `fix/terminal-and-ci`): backend.yml gains `terminal-service/**` (FE-2), drops stale `lessons_raw/**` (GAP-9) and `--async true` so the health poll validates the new build (FE-7); frontend.yml regenerates the deleted `server.js` at package time (FE-3 — repo untouched, zip layout unchanged). Still open: `**.py` over-match (FE-8), stale frontend filters `public/**`/`src/**` (FE-9), `REACT_APP_TERMINAL_WS` unset in build (FE-10), frontend sleeps/`--async`/restart race (FE-11), `CI: false` (FE-12). *Re-rated 2026-10-22: no live app to guard — pre-first-deploy gate (readiness #6); new blocker question: zero CI runs since 2026-04-22 (readiness #2).*
- **[KI-7] Proxy terminal-service WebSocket through the backend in production** — part of the AUD-1 architecture decision.
- **[KI-9] `quiz_questions.csv` committed** — referenced by `db_models.py`, `routers/classroom.py`; owner decides seeded DB vs protected storage.
- **[SEC-ENV] Confirm `frontend/.env.*` (git-tracked) contain only public URLs** (SEC-22/FE-6); agents must not read them. If not URL-only: rotate, untrack, purge.
- **[DEPLOY-1] Choose the deployment method before any CI repair is merged** — research + comparison: `docs/reports/deploy-options-2026-10-22.md` (2026-10-22). Recommended default: container image on ghcr.io → Azure Container Apps scale-to-zero (~$0–10/mo) + static frontend (Cloudflare Pages / Azure SWA, $0) + Neon free Postgres; runner-up Fly.io. Depends on readiness #1 (Azure inventory). **While undecided, AUD-2's zip-pipeline repair on `fix/terminal-and-ci` stays on hold** (readiness #15/#16); a container choice needs a Dockerfile, baked HF models, and new build+push CI, and retires `startup.sh` (readiness #17).

## Ready (code fixes awaiting approval; backend deploy on push unless noted)

- **[AUD-3] Terminal hardening (SEC-2/3/5/6) — the only part of the security batch still open.** The rest **merged to main 2026-10-23**: SEC-7, SEC-8, SEC-9/BE-4, SEC-10, SEC-11/12/21, SEC-13 (partial — BE-12's async half open), SEC-14/16 login limits + password policy (supersedes KI-1); offline tests in `backend/tests/test_security_fixes.py`. Terminal stays disabled (`ENABLE_TERMINAL` off) until hardened.
- **[AUD-6] Perf quick wins** — BE-8 per-chunk query, BE-11 blocking RAG call, BE-13 sleepless Paiza poll, BE-9/10 analytics N+1s, GAP-4 missing indexes (`SavedWork.user_id`, `ClassroomChunk.file_id`).
- **[KI-2] Specific 4xx/5xx instead of generic 500s** — 28 sites confirmed (BE-14/15).
- **[KI-3] Pagination on list endpoints** — 2 paginated vs 48 unbounded `.all()` in classroom.py (BE-7).
- **[KI-4] RAG degradation** — premise stale (BE-22): try/except + fallback exist; real gap is retrieval-only mode on LLM failure. (README wording fixed 2026-10-22.)
- **[OPS-1] Fix stale `core/config.py` defaults** — `LESSON_DIR` dead, `PDF_DIR` live and broken → `/pdfs` 500s (BE-16).
- **[AUD-7] Grouped med/low cleanups** — security: SEC-15/17/18/19/20/26/27; backend: BE-5/6/17/18/19/25; deps: FE-17 remainder (transformers/torch — revisit at the first container build) + FE-20 (FE-13 and GAP-10 merged 2026-10-23); frontend: FE-18/19 (frontend deploy; FE-16 test repair merged 2026-10-23); tests: FE-15 `pytest.ini` (requirements-dev.txt and first offline unit tests exist now). Details in the audit doc.
- **[GAP-RAG] RAG quality** — unify the two divergent chunkers (GAP-2); eval golden set + methodology DONE 2026-10-22 (`docs/modules/rag-evaluation.md`); the runner `.py` still waits for AUD-2's CI fix (GAP-3).
- **[GAP-OBS] Logging instead of print** — 193 `print(` vs 5 loggers (GAP-6, extends BE-25); module loggers + request-id middleware; batch with AUD-6.
- **[GAP-FE] Frontend duplication** — shared `api.js` for the 18 duplicated API-base fallbacks (GAP-11); merge `TopicDetailPage`/`EnhancedTopicDetailPage` (GAP-12, halves the FE-4 sink surface). Frontend deploy.
- **[FE-21] Delete unimported frontend dead code** — found during the 2026-10-23 src restructure: `src/components/Lessons.js`, `src/components/LessonLayout.js`, `src/components/ProgressAnalysisCard.js`, `src/App.css`, `src/logo.svg` have no importers (static or dynamic). Also decide on `src/TeacherClassroomDetail.js.bak` (116 KB, owner previously kept). Frontend deploy.

## Waiting

- **[OPS-2] Rename `env.example` → `.env.example`** — blocked by the owner's user-level permission glob; owner runs `mv env.example .env.example` (closes KI-8 fully).
- **[AUD-8] Untrack `practical_tests/**/.DS_Store`** — tracked despite ignore rules (pre-existing); removal touches a backend CI filter path, so batch with a deploy-triggering commit.

## Unclear

- **[KI-6] `migrate_to_postgres.py`** — confirmed absent (BE-23); README reference corrected 2026-10-22. Owner still to restore the script or drop the stale `.gitignore:47` line.

## Parked

- **[AUD-0] Azure Postgres admin password rotation** — **deferred by owner decision 2026-10-22** (owner confirms no leak; value stays in use). *Re-rated under "not deployed": no live data believed at risk; rotation (or confirming the server is deleted) is readiness #3 — required before first deploy and before the repo is ever shared.* Code side DONE 2026-10-22: `schema_migration.py`/`verify_schema.py` now read `PG_URL`/`DATABASE_URL` from the environment. **The value remains in git history and the repo is already public (verified 2026-10-23)** — rotation (or confirming the server is deleted) + history purge are urgent, not deferred-able (readiness #3). Owner also to set `PG_URL` wherever the scripts run, and may add a `PG_URL=` placeholder to `env.example`.

- **[KI-5] Local LLM fallback** (`backend/scripts/local_llm_fallback.py`) — disabled; revisit post-FYP. (BE-24's other dead-code candidates, `verify_enhanced_support.py` and `verify_schema.py`, were deleted with the 2026-10-22 restructure — only this file remains parked.)
- **[P2-public] Root `public/`** — owner 2026-10-22: leave in place (stale `frontend.yml` filter would fire).
- **[P2-bak] `frontend/src/TeacherClassroomDetail.js.bak`** — owner 2026-10-22: leave for now. Related: the live file is 3102 lines, the main refactor target (Phase 4).
- **[EXT] Extend-only items** — sandboxed Java execution (SEC-4), httpOnly-cookie auth (FE-5), Alembic (BE-21), CRA→Vite (FE-14), `backend/` restructure (propose-only move map in the improvement proposal — owner decision #9), staging slot + CI pytest gate (decision #10).
- **[GAP-OPP] Opportunistic refactors** — extract services from the 3121/2069-line routers (GAP-1), `/api` prefix convention (GAP-7), adopt `require_role()` everywhere (GAP-8), blob-size cap before storage rethink (GAP-5), worker-count review after BE-11/12 (GAP-13). Do only while touching the same files for other fixes.

## Done

- **[MERGE-1023] 2026-10-23 merge wave** — reorg stack, BE-1 env fix, terminal gate + CI partial fix, container readiness (incl. SEC-14/16, FE-16, GAP-14), 17/19 Crit/High fixes from the 2026-10-23 bug audit (`df44bad`), backend root tidy (`core/`/`services/`/`scripts/`), frontend `src/` restructure — all on `main`. Both deploy workflows manually disabled; no deploy fired. The 2026-10-23 bug-audit report itself lives on branch `docs/preserve-audit-and-ts-decision` (unmerged).
- **[AUD-4] XSS: sanitize `dangerouslySetInnerHTML` sinks** — FE-4, DOMPurify on all three sinks; merged to main 2026-10-23.
- **[AUD-5] Migration safety** — BE-2 dialect-gating, BE-3 fail-loudly (+ `--yes` guard on `schema_migration.py`); merged to main 2026-10-23.
- **[QW-1] Deploy-inert quick wins** — 2026-10-22: README aligned with the verified audit (node-pty claim removed, issues #1/#4/#6/#7/#8 corrected, upload/logging/rate-limit caveats, live-tracker link); RAG eval methodology + golden set in `docs/modules/rag-evaluation.md`.

- **[KI-8] `.env.example` placeholders** — created 2026-10-22 as `env.example` (see OPS-2 for the rename).
- **[KI-10] Loose root docs archived** — 2026-10-22, reorg Phase 2: 8 root report `*.md` + `QUICKSTART.md` (merged into `docs/OPS.md`) + `FYP RAG.ipynb` → `docs/_archives/` (see its README).
