# 2026-10-23 — Azure/GitHub read-only inventory (readiness #1/#2/#3)

**Goal:** owner-requested read-only inventory of Azure resources, GitHub workflows/secrets,
and Docker availability; report + readiness updates. No mutations, no secret values.

**Scope / files touched:**
- `docs/reports/azure-inventory-2026-10-23.md` (new — findings, cost estimate, proposed owner commands)
- `docs/plans/active/first-deploy-readiness.md` (rows #1, #2, #3 updated)
- `docs/backlog.md` (NL-1 note updated)

**Done-criteria:** report written; readiness rows reflect verified facts; nothing run that
could mutate state or reveal a secret value. ✅

## Status (handoff)

- **GitHub verified:** repo `hei416/FYP` is **public**; Actions enabled; both deploy
  workflows active; 5 secrets exist (names in report). CI silence since 2026-04-22
  explained: the only push since touched README.md only → no filter matched. Readiness #2 → Done.
- **Azure NOT verified:** `az` CLI is not installed on this machine (no `~/.azure` either),
  despite the operator believing a login existed in this shell. Owner finishes the Azure
  half via the read-only command list in the report (Cloud Shell suffices).
- **BE-1 escalated:** old Postgres password is in **public** git history now; rotate/delete
  same-day if the server exists.
- Cleanup commands proposed in the report; none run.
