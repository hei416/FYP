# Plan: Reorg Phase 1 — scaffolding (docs + rules), no code moves

## Goal

Give the repo an agent/docs skeleton (AGENTS.md, runbook, module docs, plans, backlog, decision log, project permission settings) **without moving or editing any code** and without touching any path that matches a CI deploy filter.

## Scope

New files only, plus two edits to deploy-inert root files (`.gitignore` dedupe, README untouched this phase). Explicitly out of scope: all Phase 2 moves, any `.py`/CI/frontend change, root `public/` (owner: leave), `frontend/src/TeacherClassroomDetail.js.bak` (owner: leave), `frontend/.env.*` (owner: do not read or touch).

## Files

- `/AGENTS.md`, `/CLAUDE.md` (`@AGENTS.md` import — verified documented pattern)
- `docs/OPS.md`, `docs/modules/{backend-routers,rag-pipeline,code-playground,classroom-roles,frontend}.md`
- `docs/plans/active/` (this file), `docs/plans/done/`, `docs/_archives/` (.gitkeep)
- `docs/backlog.md` (seeded from README Known Issues), `docs/strategy/decision-log.md` (skeleton, no entries yet)
- `.claude/settings.json`, `env.example` (→ `.env.example` after owner rename; write of the dotted name is permission-denied), `.gitignore` (dedupe only)
- Read-only audit output: `docs/plans/active/codebase-audit.md`, `docs/plans/active/enhancement-plan.md`

## Deliberately skipped (from the ABM pattern)

- Cron/scheduling rules and outbound-sending safeguards — nothing in this repo runs unattended or sends anything.
- Per-skill SKILL.md files — the module docs in `docs/modules/` serve that role.

## Done criteria

All files above exist on branch `reorg/phase1-scaffolding`; every commit's changed paths verified against the CI path filters (none may match); secret scan clean per commit; worktree tree clean at stop; no push.

## Status

- 2026-10-22 — Phase A (inventory + proposal) approved. Worktree `/Users/pandawork/FYP-reorg-phase1` created from `main` (23c472b).
- 2026-10-22 — Scaffolding files written and committed (4 commits; all paths verified deploy-inert, secret scans clean).
- 2026-10-22 — Read-only audit completed (security / backend / frontend+CI+deps+tests): 27 SEC + 25 BE + 20 FE findings → `codebase-audit.md`, roadmap → `enhancement-plan.md`, backlog extended. **Urgent owner actions: rotate the committed Azure Postgres admin password (BE-1); decide the terminal-service RCE mitigation (SEC-1..6).** No fixes applied — read-only per task rules.
- Phase 1 closed. NEXT (owner): review branch `reorg/phase1-scaffolding`, do Phase-0 actions in `enhancement-plan.md`, confirm decision-log entry wording, run `mv env.example .env.example`, then approve Phase 2 (doc moves). **Do not start Phase 2 without explicit owner approval. Never push — push = live deploy.**
