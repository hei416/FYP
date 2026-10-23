# README staleness pass — 2026-10-24

## Goal
Fix inaccuracies in root `README.md` found by cross-checking it against current
code and `docs/backlog.md` (user asked for a "general re-read for staleness").

## Scope
- `README.md` only.

## Done-criteria (verified findings to fix)
1. Quick Start: `cp .env.example .env` → `cp env.example .env` (file has no
   leading dot; rename is tracked as OPS-2, still pending).
2. Known Issues #1 "No password policy" — stale. `backend/routers/auth.py:32-34`
   has a `password_policy` field validator now. Remove/mark done.
3. Known Issues #7 + Interactive Terminal section — stale. AUD-1 is decided and
   implemented: `ENABLE_TERMINAL` env flag gates `/ws/terminal`, default off
   (`backend/core/config.py:98`, `backend/routers/terminal.py:28-33`).
4. Completed Fixes accuracy note — claims rate limiting excludes login/register
   (SEC-14). Stale: `backend/routers/auth.py:182,227` rate-limit both at 5/min.
5. Database section — add a note that the Azure Postgres subscription is
   currently disabled (AZ-1, `docs/backlog.md`), so `DATABASE_URL` against the
   hosted DB hangs (~75s, BE-DB-TO open) instead of failing fast; sqlite
   default is the working path for local dev.

## Status
Done — all five fixed in README.md, verified against code, committed on
`worktree-docs-readme-refresh`.
