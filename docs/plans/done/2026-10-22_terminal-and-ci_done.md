# Terminal disable + CI repair — 2026-10-22

Branch `fix/terminal-and-ci` (worktree `/Users/pandawork/FYP-terminal-ci`, from `fix/be1-credential-env` @ afa31ef; base tagged `backup/pre-terminal-ci`). Owner decisions given up front: PROP-1 = **Option B** adopted; AUD-1 = disable `/ws/terminal` behind `ENABLE_TERMINAL` (default off), no code deleted; AUD-2 = **approved** — one-off exception to the "agents never edit CI" decision, `.github/workflows/` editable for this task on this branch only; BE-1/AUD-0 stays Parked, untouched.

## Goal

Three separate commits, in order:

1. **Docs cleanup** — correct every wrong node-pty/PTY claim (terminal-service uses plain `child_process`); mark PROP-1 and AUD-1 Decided in backlog + audit; append the two owner-approved decision-log entries (Option B baseline; `backend/` restructure propose-only).
2. **Disable `/ws/terminal` behind `ENABLE_TERMINAL`** (default off → handshake rejected with HTTP 403; no deletions) + offline pytest (FastAPI TestClient, no network) + document flag, test, and the production impact (in-browser Java terminal stops; frontend falls back to HTTP/Paiza) in `docs/OPS.md` and `docs/modules/code-playground.md`.
3. **CI repair, isolated/droppable** — backend.yml: drop stale `lessons_raw/**`, add `terminal-service/**`, remove `--async true` so the health poll waits for the new build; frontend.yml: fix the zip line that references the deleted `server.js` (deleted in bec2835). Exact diff + one-line explanations for owner review.

## Scope

- Edit: `AGENTS.md`, `README.md`, `docs/**` (backlog, audit, decision log append-only, OPS, code-playground, this plan), `routers/terminal.py`, `core/config.py`, new `tests/test_terminal_proxy.py`, `.github/workflows/backend.yml`, `.github/workflows/frontend.yml` (AUD-2 exception, this branch only).
- Never: push/merge/deploy/Azure; `.env*`/secrets; `vectorstore/`, `frontend/**`, root `public/`, `*.bak`; no code deletions.

## Done criteria

Per commit: blocking secret scan clean (any hit blocks the commit; inspected before retry); changed paths listed and classified deploy-triggering or not; `python -c "import main"`, `python -c "from core import config"`, the new pytest, `git status` clean. Commit 3 additionally: workflow YAML validated offline (`yaml.safe_load`). Finish: statuses updated in backlog/audit, clean tree, STOP (owner reviews, merges, deploys by hand).

## Notes

- Python env: no `.venv` exists in this worktree; using `/Users/pandawork/FYP-reorg-phase2/.venv` (Python 3.11.15, full requirements) with `pytest` installed ad hoc per OPS.md.
- The exact decision-log wording proposed in the analysis-proposal session lived only in that session's summary (its plan file records "proposed to owner in the session summary — not written to the log"). The two entries appended here are reconstructed from the improvement proposal's own language for the same two decisions, per the owner's instruction.

## Status

- 2026-10-22 — Started. Worktree + branch created; base tagged `backup/pre-terminal-ci`.
- 2026-10-22 — Commit 1 (docs cleanup): 8 wrong pty/node-pty claims corrected (AGENTS.md ×2, README ×3, OPS.md ×1, code-playground.md ×2); PROP-1 + AUD-1 marked Decided in backlog and audit; two decision-log entries appended (Option B baseline; backend/ restructure propose-only).
- 2026-10-22 — Commit 2 (AUD-1 implementation): `ENABLE_TERMINAL` flag added to `core/config.py` (default off); `routers/terminal.py` rejects the `/ws/terminal` handshake with HTTP 403 / close 1008 when off (no deletions); offline pytest `tests/test_terminal_proxy.py` (3 tests, TestClient only, no network) passing; flag + production impact documented in OPS.md and code-playground.md.
- 2026-10-22 — Commit 3 (AUD-2 partial, owner-approved): backend.yml — stale `lessons_raw/**` dropped (GAP-9), `terminal-service/**` added (FE-2), `--async true` removed from `az webapp deploy` so the health poll waits for the new build (FE-7); frontend.yml — `server.js` (deleted in bec2835) regenerated at package time before the zip step (FE-3; repo layout untouched, works on express 4 and 5). Both YAMLs validated offline (`yaml.safe_load`). FE-8/9/10/11/12 left open by design. Docs (AGENTS.md triggers, OPS.md deploy mechanics, backlog, audit) aligned.
- 2026-10-22 — **Complete.** Per commit: blocking secret scan clean; `import main` / `from core import config` OK; `pytest tests/test_terminal_proxy.py` 3 passed; tree clean. Not pushed — owner reviews, merges and deploys by hand. **If merged to main: commits 2 and 3 both trigger deploys** (commit 2 → backend via `**.py`/`routers/`/`core/`; commit 3 → both pipelines via `.github/workflows/*` self-filters — the workflow-file change itself fires each workflow); commit 1 is deploy-inert alone, but ships with the others once batched in one push.
