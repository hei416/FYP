# Backend root tidy

## Goal
Move the 8 loose `.py` modules at `backend/` root into the existing package structure, leaving only `main.py` (entry point, referenced by startup.sh/Dockerfile as `main:app`), config/data files, and packages.

Owner-approved 2026-10-23 (chat): "do the follow task … the backend root problem".

## Mapping
| From (backend/) | To | Importers to rewrite |
|---|---|---|
| `database.py` | `core/database.py` | 17 |
| `db_models.py` | `core/db_models.py` | 15 |
| `models.py` (LLM client wrappers) | `core/models.py` | 4 |
| `rag_system.py` | `services/rag_system.py` | 1 (main.py, lazy) |
| `create_admin.py` | `scripts/create_admin.py` | 0 (standalone) |
| `schema_migration.py` | `scripts/schema_migration.py` | 0 (standalone) |
| `rebuild_vectorstore.py` | `scripts/rebuild_vectorstore.py` | 0 (standalone; fix its `PROJECT_ROOT = Path(__file__).parent` → `.parent.parent`) |
| `local_llm_fallback.py` | `scripts/local_llm_fallback.py` | 0 (standalone doc/script) |

Stays at root: `main.py`, `Dockerfile`, `requirements*.txt`, `quiz_questions.csv` (KI-9 owns its future), data dirs (`java_docs/`, `practical_tests/`, `vectorstore/` — untouchable, `evaluation/`).

## Pre-verified facts
- startup.sh / Dockerfile / compose / workflows reference only `main:app` and `routers.practical_tests` — no loose-module names.
- No string-based `patch()` / importlib references to these modules in tests.
- Only `rebuild_vectorstore.py` uses `__file__` for pathing.
- `core/__init__.py` is empty (no cycle risk); project style is absolute imports (`from core.config import …`).
- Moved scripts get the `sys.path.insert(0, ROOT)` shim already used by `scripts/create_tables.py` so `python scripts/<name>.py` keeps working from `backend/`.
- Known residual risk (accepted): committed FAISS pickles can't be inspected (hard rule 3); langchain `save_local` pickles only Documents/docstore, so no project-module references expected.

## Done-criteria / verification
- Fresh worktree venv: `python -c "import main"` passes; offline pytest green (same count as baseline run).
- Docs updated: `backend/AGENTS.md` (map + script paths), root `AGENTS.md` table, `docs/OPS.md`, `docs/modules/rag-pipeline.md` + other `docs/modules/` references.
- Secret-scan diff; changes match the latent `backend/**` filter — expected, never pushed (hard rule 1).

## Status
- 2026-10-23: Plan created on branch `refactor/backend-root-tidy` (worktree `backend-root-tidy`). Also this session: verified `refactor/frontend-src-structure` OK to merge (browser smoke over 10 routes, zero errors).
- 2026-10-23: DONE at 384811c (code) + docs commit. 8 modules moved, ~49 import lines rewritten in 20 files, script shims + PROJECT_ROOT fix, docs/README/AGENTS updated. Verified in fresh py3.11 venv: `import main` = 120 routes, offline pytest 36 passed, moved scripts smoke-tested. Branch local-only — NOT merged/pushed (matches `backend/**` deploy filter; owner pushes). Note: no venv existed on this machine; one was created at `backend/.venv` in this worktree (gitignored) — system python3 is 3.9, use `/opt/homebrew/bin/python3.11`.
