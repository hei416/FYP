# Backlog

One task per entry. Keep this file under 150 lines — minor items are grouped. Seeded 2026-10-22 from the README "Known Issues & TODOs" table (KI-n keeps its numbering) and the verified read-only audit (`docs/plans/active/codebase-audit.md` — SEC/BE/FE/GAP IDs). Roadmap: `docs/reports/improvement-proposal-2026-10-22.md` (supersedes `enhancement-plan.md` phasing); analysis: `docs/reports/codebase-analysis-2026-10-22.md`. Reminder: any `.py` fix deploys the backend when pushed; batch and get owner review.

## Needs human (owner action, before code fixes)

- **[PROP-1] Decide improvement option A / B / C** — see `docs/reports/improvement-proposal-2026-10-22.md` §Decisions (10 items, each with a recommended default; default overall: **B**). Gates AUD-3..7 batching.

- **[AUD-0] Rotate the Azure Postgres admin password** — committed in `schema_migration.py:16-19` and `verify_schema.py:7` (BE-1). Rotate first, then code cleanup + history purge.
- **[AUD-1] Terminal-service RCE decision** — unauthenticated ws + file write + unsandboxed java (SEC-1..6/FE-1), runs in production via `startup.sh:88-90`. Quick option: disable the `/ws/terminal` proxy until hardened.
- **[AUD-2] CI workflow fixes (one owner-reviewed commit)** — backend.yml misses `terminal-service/**` (FE-2) and over-matches `**.py` (FE-8); health polls validate the previous build (FE-7/FE-11); frontend.yml zips a deleted `server.js` — the frontend pipeline may be broken today (FE-3); stale filters (FE-9, GAP-9 — nonexistent `lessons_raw/**`); `REACT_APP_TERMINAL_WS` unset in build (FE-10); `CI: false` (FE-12). Owner also picks the FE-3 fix shape (proposal decision #5).
- **[KI-7] Proxy terminal-service WebSocket through the backend in production** — part of the AUD-1 architecture decision.
- **[KI-9] `quiz_questions.csv` committed** — referenced by `db_models.py`, `routers/classroom.py`; owner decides seeded DB vs protected storage.
- **[SEC-ENV] Confirm `frontend/.env.*` (git-tracked) contain only public URLs** (SEC-22/FE-6); agents must not read them. If not URL-only: rotate, untrack, purge.

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

- **[KI-5] Local LLM fallback** (`local_llm_fallback.py`) — disabled; revisit post-FYP. Dead-code removal candidates alongside it: `verify_enhanced_support.py`, `verify_schema.py` (BE-24 — deletes, owner-gated).
- **[P2-public] Root `public/`** — owner 2026-10-22: leave in place (stale `frontend.yml` filter would fire).
- **[P2-bak] `frontend/src/TeacherClassroomDetail.js.bak`** — owner 2026-10-22: leave for now. Related: the live file is 3102 lines, the main refactor target (Phase 4).
- **[EXT] Extend-only items** — sandboxed Java execution (SEC-4), httpOnly-cookie auth (FE-5), Alembic (BE-21), CRA→Vite (FE-14), `backend/` restructure (propose-only move map in the improvement proposal — owner decision #9), staging slot + CI pytest gate (decision #10).
- **[GAP-OPP] Opportunistic refactors** — extract services from the 3121/2069-line routers (GAP-1), `/api` prefix convention (GAP-7), adopt `require_role()` everywhere (GAP-8), blob-size cap before storage rethink (GAP-5), worker-count review after BE-11/12 (GAP-13). Do only while touching the same files for other fixes.

## Done

- **[QW-1] Deploy-inert quick wins** — 2026-10-22: README aligned with the verified audit (node-pty claim removed, issues #1/#4/#6/#7/#8 corrected, upload/logging/rate-limit caveats, live-tracker link); RAG eval methodology + golden set in `docs/modules/rag-evaluation.md`.

- **[KI-8] `.env.example` placeholders** — created 2026-10-22 as `env.example` (see OPS-2 for the rename).
- **[KI-10] Loose root docs archived** — 2026-10-22, reorg Phase 2: 8 root report `*.md` + `QUICKSTART.md` (merged into `docs/OPS.md`) + `FYP RAG.ipynb` → `docs/_archives/` (see its README).
