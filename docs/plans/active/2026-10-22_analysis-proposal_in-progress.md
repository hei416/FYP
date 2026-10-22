# Analysis report + improvement proposal — 2026-10-22

Read-only, docs-only task on branch `docs/analysis-proposal` (worktree `/Users/pandawork/FYP-analysis`, from `reorg/phase2-moves`). No code, config, CI or secret changes; no fixes.

## Goal

1. Verify the existing audit (`codebase-audit.md`): spot-check every critical and high finding (Confirmed / Stale / Disputed), correct the doc, add evidence-backed gap findings.
2. Write `docs/reports/codebase-analysis-2026-10-22.md` (exec summary, architecture diagram, findings table, what to keep).
3. Write `docs/reports/improvement-proposal-2026-10-22.md` (options A/B/C, recommendation, roadmap, target-structure move map, deploy-inert vs deploy-triggering quick wins, owner decisions list).
4. Update `docs/backlog.md` (≤150 lines) to match; propose decision-log wording to the owner (no decision-log edits).

## Scope

Only: `docs/**` (new `docs/reports/`, audit doc corrections, backlog, this plan). Out of scope: every code/config/CI path, `.env*`, `vectorstore/`, secrets, pushes/merges/deploys, audit fixes.

## Done criteria

All crit/high findings marked Confirmed/Stale/Disputed with the audit doc corrected; both report docs written; backlog ≤150 lines and consistent with the proposal; per commit: secret scan clean + changed paths listed and matched against CI filters (all must be deploy-inert); clean tree; summary (EN + 5-line ZH) delivered; no push.

## Status

- 2026-10-22 — Started. Worktree + branch created from `reorg/phase2-moves` (add8edc).
