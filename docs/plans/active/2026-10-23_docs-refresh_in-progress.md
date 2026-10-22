# Docs refresh — 2026-10-23

**Goal**: bring every markdown doc in line with the repo's current state (post backend-tidy `core/`/`services/`/`scripts/`, post frontend `src/` restructure, fix branches merged to main, both deploy workflows `disabled_manually`).
**Scope**: docs only — no code, no CI, no secrets, nothing run. Dated reports (`docs/reports/`) and `docs/_archives/` untouched by design (point-in-time). Decision log untouched (append-only, owner wording).
**Branch**: `worktree-docs-refresh` (worktree `.claude/worktrees/docs-refresh`). Never pushed.
**Done-criteria**: no doc claims a pre-tidy path, a wrong router count, "pending owner merge" for a merged branch, or "workflows active"; `_done` plans live in `done/`; duplicate/stale top-level docs consolidated; clean tree.

## Verified facts the edits rest on (2026-10-23)

- `backend/` root has only `main.py`; modules live in `core/` (7 files), `services/` (6), `scripts/` (8). `frontend/src/` = pages/components/services/utils/data.
- `main.py` registers **12** routers in the static list (~line 550) — several docs said 13 / ~line 505.
- `git branch --merged main`: `refactor/backend-and-prebuild-fixes`, `fix/terminal-and-ci`, `fix/be1-credential-env`, `integration/container-readiness`, `docs/analysis-proposal`, `docs/deploy-options`, `docs/not-live-reassessment` all merged. `df44bad` ("Merge fix/bug-audit-crit-high: close 17 of 19") is in main's history.
- `gh workflow list --all`: both deploy workflows **disabled_manually**.
- `verify_schema.py` / `verify_enhanced_support.py` deleted at the restructure commit (`c199d20`); `.gitignore:47` still lists `migrate_to_postgres.py` (KI-6 unchanged).

## Files to touch

- Counts/paths: `AGENTS.md` (root), `backend/AGENTS.md`, `backend/routers/AGENTS.md`, `backend/services/AGENTS.md`, `docs/OPS.md`, `docs/modules/backend-routers.md`, `docs/modules/rag-pipeline.md`, `README.md`.
- Situation (merges + disabled workflows): `docs/backlog.md`, `docs/plans/active/first-deploy-readiness.md`, `docs/plans/active/codebase-audit.md` (dated note appended, body untouched), `docs/plans/active/enhancement-plan.md` (superseded banner).
- Rewrites: `.github/copilot-instructions.md` (current layout; delete the stale duplicate `copilot-instructions-new.md`), `frontend/README.md` (thin, frontend-only, link out).
- Plan moves to `done/`: deploy-options, azure-inventory, analysis-proposal, backend-restructure, bug-audit-crit-high, container-readiness (statuses appended first; cross-link in codebase-audit.md updated).

## Status

- 2026-10-23 — Started; facts verified (see above). Edits in progress.
