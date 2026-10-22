# Deploy-options research — 2026-10-22

**Goal**: docs-only research + recommendation for a deployment method (zip-deploy is broken/latent; CI repair on hold). No code/CI/Azure change.
**Scope**: repo fact-finding (grep only), web research against official pricing/docs, one report, readiness-checklist section, one backlog entry.
**Deliverable**: `docs/reports/deploy-options-2026-10-22.md` (comparison a–f, top-2, default + rollback story, repo needs, facts-vs-assumptions).
**Done-criteria**: report written; readiness rows #15–17 added; backlog DEPLOY-1 added; docs-only diff; clean tree. All met.

## Status

- **2026-10-22 — DONE (research); decision now with the owner (DEPLOY-1 / readiness #15).** Recommended default: ghcr.io image → Azure Container Apps scale-to-zero + static frontend (CF Pages / Azure SWA) + Neon free Postgres; runner-up Fly.io. AUD-2's zip-pipeline repair on `fix/terminal-and-ci` stays **on hold** until the method is chosen. Branch `docs/deploy-options` (off `docs/not-live-reassessment`), not pushed. Changed paths: `docs/reports/deploy-options-2026-10-22.md` (new), `docs/plans/active/first-deploy-readiness.md`, `docs/backlog.md`, this file.
