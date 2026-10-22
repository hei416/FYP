# Enhancement plan — 2026-10-22

> **Superseded 2026-10-22** by the phased roadmap in `docs/reports/improvement-proposal-2026-10-22.md` (Option B adopted — decision log). Kept for its audit-ID → phase mapping; item-level status lives in `docs/backlog.md` (much of Phase 0/1 was merged to main 2026-10-23). Do not work from this file.

Prioritised roadmap from the audit (`codebase-audit.md` — IDs referenced below). Tuned to the owner's stated purpose **maintain + portfolio** (extend-only items are marked); **no deadline** assumed. Nothing here is started without owner approval. Every backend `.py` fix deploys on push — fixes are batched into few, owner-reviewed pushes, and note FE-7: the CI health check currently validates the *previous* build, so verify the live site manually after each deploy.

## Phase 0 — owner-only actions (no code, do these first)

1. **Rotate the Azure Postgres admin password** (BE-1) — the current one is committed in two tracked files. Rotation must precede the code cleanup, else history still leaks a live credential.
2. **Decide the terminal-service strategy** (SEC-1..6, FE-1): quickest safe option is disabling the `/ws/terminal` proxy route + keeping :3001 unexposed until hardened; full fix is Phase 1.
3. **Confirm `frontend/.env.*` contents** are URL-only (SEC-22/FE-6); if not, rotate whatever they hold.
4. **Approve a dedicated CI-workflow fix** (FE-2 terminal-service filter, FE-7/FE-11 async health checks, FE-3 frontend zip of deleted server.js, FE-8 over-broad `**.py`, FE-9 stale filters). CI edits were explicitly out of scope for agents; this needs one owner-reviewed commit, and FE-3 suggests the frontend pipeline may be broken today — worth checking the last run's logs.

## Phase 1 — security batch (quick wins; one reviewed backend deploy)

All S/M effort, highest risk reduction per line: remove hardcoded DSN (BE-1 code side) · block self-registration as teacher (SEC-7) · stop returning tracebacks (SEC-9/BE-4) · CORS allowlist (SEC-8) · auth on conversation/LLM endpoints (SEC-11, SEC-12, SEC-21) · login/register rate limits + password policy (SEC-14, SEC-16 — supersedes README issue #1, whose "unwired validator" doesn't exist) · classroom file access check (SEC-10) · SSRF allowlist on the webpage proxy (SEC-13/BE-12) · terminal-service filename allowlist + token check on the proxy + localhost binding (SEC-2, SEC-3, SEC-5, SEC-6). Frontend side (separate frontend deploy): DOMPurify on the `dangerouslySetInnerHTML` sinks (FE-4).

## Phase 2 — reliability & performance batch

Migrations: dialect-gate the Postgres-only SQL and fail loudly (BE-2, BE-3). Perf quick wins: batch the per-chunk query (BE-8), `to_thread` the blocking RAG call (BE-11), sleep+timeout in the Paiza poll (BE-13), fix the two analytics N+1s (BE-9, BE-10). Config: delete dead `LESSON_DIR`, repair `PDF_DIR` + graceful 404 (BE-16). Hygiene: specific error codes (BE-14/15, README issue #2), pagination (BE-7, issue #3), proxy-aware rate-limit keys (SEC-15), shorter JWTs (SEC-17), CSPRNG join codes (SEC-18), upload checks on the legacy route (SEC-20), locked singletons + LRU cache (BE-18, BE-19), `python-multipart`/`bcrypt` bumps (FE-13, FE-17).

## Phase 3 — portfolio polish (mostly deploy-inert or low-risk)

README accuracy (issue #4 premise stale per BE-22; issue #6 confirmed per BE-23; node-pty claim false; link Known Issues → `docs/backlog.md`) · remove dead code `verify_enhanced_support.py`, `verify_schema.py` (BE-24 — deletes, owner-gated) · quiet startup logging (BE-25) · strip prod `console.*` (FE-18) · a11y labels + two real button conversions (FE-19) · fix/delete the broken CRA test stub (FE-16) · `dev-requirements.txt` + `pytest.ini` + first backend unit tests for auth/roles (FE-15 — the single biggest credibility gap for a portfolio repo: the backend has zero unit tests).

## Phase 4 — larger items (extend-only / optional for maintain+portfolio)

Proper sandboxing of Java execution (SEC-4: container/nsjail, resource caps) · httpOnly-cookie auth migration (FE-5/SEC-23) · Alembic as the single migration path (BE-21) · refactor `TeacherClassroomDetail.js` (3102 lines) · CRA → Vite (FE-14) · production terminal proxy architecture (README issue #7) · thread-safety rework of the shared FAISS chain (BE-5/BE-6) · `quiz_questions.csv` out of git (issue #9).

## Skipped, and why

Cron/scheduling rules and outbound-sending safeguards (nothing runs unattended or sends); per-skill SKILL.md files (module docs cover it); dynamic scanning (`npm audit`, `pip-audit`, live probes) — static pass only.
