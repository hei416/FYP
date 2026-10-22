# Backlog

One task per entry. Keep this file under 150 lines — summarise minor items into grouped entries. Seeded 2026-10-22 from the README "Known Issues & TODOs" table (README now links here; numbers kept for traceability). Audit findings reference `docs/plans/active/codebase-audit.md` IDs.

## Ready

- **[KI-1] Wire password strength validation into auth endpoints** — `routers/auth.py`. Fix triggers a backend deploy.
- **[KI-2] Replace generic 500s with specific 4xx/5xx codes** — across `routers/*.py`. Backend deploy.
- **[KI-3] Add pagination to large query results** (e.g. student lists) — `routers/`. Backend deploy.
- **[KI-4] RAG graceful degradation** — wrap `rag_chain()` in try/except for retrieval-only fallback in `routers/rag.py`. Backend deploy.
- **[OPS-1] Fix stale defaults in `core/config.py`** — `PDF_DIR` (`frontend/Lecture Notes-20250622`) and `LESSON_DIR` (`lessons_raw`) point at nonexistent dirs. Backend deploy.

## Waiting

- **[KI-10] Consolidate 8 loose root `*.md` report files into `docs/_archives/`** — Phase 2 of the reorg; awaiting owner approval.
- **[OPS-2] Rename `env.example` → `.env.example`** — blocked by the owner's user-level permission glob; owner runs `mv env.example .env.example` (closes KI-8 fully).

## Needs human

- **[KI-7] Proxy terminal-service WebSocket through the backend in production** — security risk if exposed directly; touches live Azure architecture.
- **[KI-9] `quiz_questions.csv` committed to repo** — may hold sensitive test data; it is referenced by `db_models.py` and `routers/classroom.py`, so moving it is a code change. Owner to decide: seeded DB vs protected storage.
- **[SEC-ENV] Confirm `frontend/.env.*` (git-tracked) contain only public URLs** — owner has not confirmed; agents must not read them.

## Unclear

- **[KI-6] `migrate_to_postgres.py` referenced in README but not tracked** — note: `.gitignore` explicitly ignores this filename, so it may exist locally by design. Verify and either track it or fix the README reference.

## Parked

- **[KI-5] Local LLM fallback (`local_llm_fallback.py`, Llama 2 CPU)** — disabled via `OLLAMA_FALLBACK_ENABLED=False`; revisit post-FYP.
- **[P2-public] Root `public/` legacy dir** — owner decision 2026-10-22: leave in place (moving trips the stale `frontend.yml` filter).
- **[P2-bak] `frontend/src/TeacherClassroomDetail.js.bak` (116 KB, tracked)** — owner decision 2026-10-22: leave for now.

## Done

- **[KI-8] `.env.example` with placeholder values** — created 2026-10-22 as `env.example` (see OPS-2 for the rename).
