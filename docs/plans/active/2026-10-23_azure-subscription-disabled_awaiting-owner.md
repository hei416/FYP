# Azure subscription disabled — diagnosis and backlog entry (2026-10-23)

## Status

**Awaiting owner.** Diagnosis complete and verified against live Azure (read-only).
The fix is a **billing action only the owner can take** — no agent, and no CLI, can
perform it. Docs updated; no code changed.

**Handoff:** branch `worktree-docs-azure-subscription-disabled`, based on `4211ee4`
(`origin/main` at the time), in a git worktree under `.claude/worktrees/`. **Not
pushed** (hard rule 1) — the owner merges. Keep the worktree on session exit, or the
branch is discarded. Note `4211ee4` may be ahead of a stale local `main`.

## Goal

Explain the local `psycopg2.OperationalError: connection ... timed out` against
`fyp-postgres-db.postgres.database.azure.com:5432`, rule out the suspected causes,
and record the real one in the backlog for owner action.

## Trigger

Owner reported, while running the backend locally against the Azure DB:

- Browser: `ERR_CONNECTION_TIMED_OUT` on `/my-work/list` and `/classrooms/public`.
- Backend: unhandled `OperationalError` on `POST /auth/login`, TCP connect to
  `fyp-postgres-db...:5432` timing out.

Owner asked whether the Crit/High bug-fix commit (`a43f2c2`) caused it.

## Findings

### 1. Not caused by `a43f2c2` (ruled out on mechanism, not just file list)

| Changed file | What changed | Can it time out? |
|---|---|---|
| `backend/routers/my_work.py` | `SaveWorkRequest` validation (S19) — `/my-work/save` only | No; `/my-work/list` untouched |
| `backend/routers/classroom.py` | answer-key stripping + membership/ownership guards | No; all return 403/200 immediately |
| `backend/routers/auth.py` | `SECRET_KEY` sentinel guard (S7) | No; raises 500 immediately |

Every failure mode that commit can introduce returns **fast**. A connect timeout is
not among them. `backend/database.py` and `backend/core/config.py` were not touched by
it (last changes: `8f696e2`, `c199d20`).

### 2. Root cause — the Azure subscription is disabled

Verified 2026-10-23 with `az` (installed this session; see decision note below):

```
Subscription "Azure for Students" (<subscription-id>)   state: Disabled
fyp-postgres-db (fyp-rg, France Central, B1ms, PG16)  state: Disabled
codetutor-fyp-hei / codetutor-frontend-hei       state: AdminDisabled
```

Azure returns `ReadOnlyDisabledSubscription` on any write. A disabled subscription
deactivates every resource in it; the DB server still exists as an ARM record and DNS
still resolves, but nothing listens on 5432 — hence a silent TCP timeout rather than a
refusal. Full evidence: `docs/reports/azure-inventory-2026-10-23.md` §Azure (verified).

Ruled out along the way:
- **Firewall** — a single firewall rule permits all IPv4
  with `publicNetworkAccess: Enabled`. The dev machine's IP was never blocked. (This
  wide-open rule is itself a finding — backlog **AZ-2**.)
- **Idle auto-stop** — that presents as `state: Stopped` and is fixed by
  `az postgres flexible-server start`. `Disabled` is a billing state, one level up.
- **Local network** — control connects to `1.1.1.1:443` and `8.8.8.8:53` both succeed.

### 3. Why the browser saw a timeout instead of a 500

`backend/database.py:16` passes no `connect_timeout` for the non-sqlite branch, so each
psycopg2 connect blocks for the macOS TCP timeout (~75 s), and `pool_pre_ping=True`
makes every request pay it. The browser gives up before any response arrives. Backlog
**BE-DB-TO**.

## Scope

Docs only. Files touched:

- `docs/plans/active/2026-10-23_azure-subscription-disabled_awaiting-owner.md` (this file)
- `docs/reports/azure-inventory-2026-10-23.md` — Azure half filled in, verified
- `docs/backlog.md` — AZ-1, AZ-2, BE-DB-TO added; AUD-0 corrected
- `docs/plans/active/first-deploy-readiness.md` — rows #1 and #3 updated

No code change in this task. `BE-DB-TO` is left as a backlog item, not applied.

## Owner decisions needed

1. **AZ-1** — renew Azure for Students, or convert to pay-as-you-go, or write the
   resources off and move to the DEPLOY-1 target (ACA + Neon) from scratch. Note the
   deletion clock: disabled subscriptions lose their resources after a grace period
   whose length is **unverified here** — confirm it in the portal.
2. **AZ-2** — narrow or delete the all-IPv4 Postgres firewall rule if the
   subscription is restored (must happen in the same sitting as the BE-1 rotation).
3. **BE-DB-TO** — approve the one-line `connect_timeout` hardening.

## Note on the hard rules

`AGENTS.md` hard rule 2 ("never `az`") was **overridden by the owner directly** in this
session ("can you use cli to handle the azure situation for me"), scoped to the Postgres
server. Only read-only commands were run; `az` was installed via Homebrew. No deploy,
no `gh workflow run`, no App Service settings read or written. The rule stands for
future sessions unless the owner overrides it again.

## Done-criteria

- [x] `a43f2c2` ruled out on mechanism
- [x] Root cause verified against live Azure, not inferred
- [x] Inventory report's UNVERIFIED Azure half replaced with verified facts
- [x] Backlog entries added with evidence links
- [x] Readiness rows #1/#3 updated
- [ ] Owner acts on AZ-1 (blocks AZ-2 and anything needing the DB)
