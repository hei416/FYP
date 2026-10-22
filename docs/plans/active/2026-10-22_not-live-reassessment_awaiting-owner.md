# Not-live reassessment (docs only) — 2026-10-22

## Goal

Record the owner's statement that the application has **never been live in production**, collect read-only deployment evidence from the repo + GitHub (no Azure access, nothing triggered), re-base every "live deployment" claim in the docs, re-run the proposal's risk assessment under "not deployed", and produce a first-deploy readiness checklist.

## Scope

Docs only: `AGENTS.md`, `docs/OPS.md`, `docs/reports/*` (new evidence report + addendum/notes), `docs/plans/active/codebase-audit.md` (annotation), `docs/modules/code-playground.md`, `docs/modules/frontend.md`, `docs/backlog.md`, new `docs/plans/active/first-deploy-readiness.md`, this plan. **No code, CI file, secret, `.env*`, `vectorstore/`, `frontend/**` (except the one module doc lives in docs/), root `public/`, or `.bak` changes. No push, no Azure, nothing run via `gh` beyond read-only `run list` / `run view` / `api` GETs.**

## Done criteria

Evidence recorded with verified vs unverifiable clearly separated; every "live/push=deploy" claim re-worded or annotated; proposal re-rated (findings + options A/B/C) with a recommended option; readiness checklist with Done/Open/Needs-owner marks; backlog ≤150 lines; decision-log wording **proposed only** (log untouched); per commit: blocking secret scan + changed-paths check (all deploy-inert docs); clean tree.

## Status

- 2026-10-22 — Evidence collected (see `docs/reports/deployment-evidence-2026-10-22.md`). Key tension: owner states never live, but GitHub Actions history shows 408 deploy runs (Mar–Apr 2026) with dozens of successes against real App Services, then zero runs since 2026-04-22 despite filter-matching pushes. Statement recorded as owner's, discrepancy flagged for owner confirmation.
- 2026-10-22 — **Complete, awaiting owner.** All doc edits committed (docs-only, deploy-inert; secret scans clean; clean tree). Owner to: (1) confirm/correct the deployment-history statement against the evidence report, (2) confirm the two proposed decision-log entries (in the session summary; the log itself was not touched), (3) review `docs/plans/active/first-deploy-readiness.md` "Needs owner" items. Branch: `docs/not-live-reassessment` (stacked on `fix/terminal-and-ci`).
