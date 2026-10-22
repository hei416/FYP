# BE-1 code side: move hardcoded DSN to env vars — 2026-10-22

Branch `fix/be1-credential-env` (worktree `/Users/pandawork/FYP-be1`, from `docs/deploy-inert-quick-wins`). Owner decision 2026-10-22: **password rotation deferred** (owner confirms no leak; value stays valid and remains in git history — tracked as Parked in the backlog). Explicitly approved scope: replace the hardcoded `PG_URL` in `schema_migration.py` and `verify_schema.py` with environment lookups so the value stops spreading. The secret value is never printed, copied, or written anywhere by this task.

## Scope

- `schema_migration.py`, `verify_schema.py`: `PG_URL` from `os.environ` (`PG_URL`, falling back to `DATABASE_URL`), hard failure with a clear message when unset.
- `docs/backlog.md`: AUD-0 → Parked with the owner decision and the git-history note.
- Audit doc: one-line owner-decision annotation on act-first item 1.
- NOT touched: `env.example` (owner said leave it alone — a `PG_URL=` placeholder line is proposed to the owner instead), `.env*`, history purge, any other `.py`.

## Deploy note

Both edited files match the backend CI filter (`'**.py'`): **a push of this branch deploys the backend**. Local only; owner reviews and pushes. The scripts are standalone (zero imports from the app — audit BE-24), so the app's runtime behaviour is unchanged.

## Done criteria

No `postgresql://` DSN left in any tracked source file; both scripts compile and fail loudly without the env var; `import main` + `from core import config` still pass; secret scan of **added** lines clean; backlog/audit/plan updated; clean tree; no push.

## Status

- 2026-10-22 — Started on explicit owner instruction.
