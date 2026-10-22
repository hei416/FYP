# Per-folder AGENTS.md rollout

**Goal:** align the repo with the per-folder doc pattern — every purposeful folder carries a short AGENTS.md (purpose, rules, commands, boundaries) so an agent landing in a folder knows what it is and how to work in it without scanning the tree.

**Scope (files to touch):**
- New: `backend/AGENTS.md`, `backend/routers/AGENTS.md`, `backend/services/AGENTS.md`, `backend/tests/AGENTS.md`, `frontend/AGENTS.md`, `terminal-service/AGENTS.md`, `docs/AGENTS.md`
- Edit: root `AGENTS.md` (docs map gains a per-folder-guides line)
- Out of scope: deeper subfolders (`backend/core/`, `frontend/src/`, …) — covered by their parent's file; add later only if a folder grows its own rules.

**Rules applied:** one source of truth — each per-folder file links to `docs/OPS.md` / `docs/modules/*` rather than copying; each file well under 150 lines; no new files in the repo root.

**Done-criteria:**
- The 7 files exist, accurate against the current tree (verified, not guessed).
- Root AGENTS.md points to the pattern.
- Diff secret-scanned; changed paths listed against CI filters (note: `backend/**`, `frontend/**`, `terminal-service/**` AGENTS.md files DO match the latent deploy filters — commit stays local on the worktree branch per hard rule 1; owner decides on push).
- Committed on `worktree-docs-per-folder-agents`, clean tree.

## Status

2026-10-23 — **done, awaiting owner review/merge.** 7 per-folder AGENTS.md created, root AGENTS.md updated (per-folder-guides pointer + deploy-inert caveat: workflow filters have no `.md` exclusion, so AGENTS.md files inside `backend/`/`frontend/`/`terminal-service/` match the latent deploy filters — verified against `.github/workflows/*.yml`). Diff secret-scanned (clean). Committed on `worktree-docs-per-folder-agents`. **Owner note before merging to main + pushing:** this change touches filter-matching paths; both workflows were disabled_manually as of 2026-10-23, but confirm that's still true (or accept the trigger) before pushing. Rename this file `_done` and move to `docs/plans/done/` after merge.
