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
- 2026-10-22 — **Complete** in 5 commits, read-only/docs-only throughout. (1) All 34 crit/high audit IDs verified against code — **all Confirmed**, none Stale/Disputed (one nuance noted on BE-6); 13 new gap findings (GAP-1..13) appended to the audit doc. (2) `docs/reports/codebase-analysis-2026-10-22.md` written. (3) `docs/reports/improvement-proposal-2026-10-22.md` written — recommends **option B**; `backend/` restructure recorded propose-only. (4) Backlog updated (51 lines): PROP-1 decision entry, GAP items folded into AUD-2/6/7, new GAP-RAG/GAP-OBS/GAP-FE/GAP-OPP entries. Per commit: secret scan clean, all changed paths `docs/**` (deploy-inert, no CI filter match). Decision-log wording proposed to owner in the session summary — **not** written to the log. Plan stays in active/ until the owner answers PROP-1; then file to done/.
- 2026-10-23 — PROP-1 was answered 2026-10-22 (Option B, decision log); branch `docs/analysis-proposal` merged to `main`. Filed to `done/`.
