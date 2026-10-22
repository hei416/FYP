# Deploy-inert quick wins — 2026-10-22

Branch `docs/deploy-inert-quick-wins` (worktree `/Users/pandawork/FYP-quickwins`, from `docs/analysis-proposal`). The quick-wins list every proposal option (A/B/C) shares — docs only, no `.py`, no CI, no secrets, nothing matching a deploy path filter.

## Goal

1. README accuracy (BE-22/23, SEC-16 wording, node-pty claim, stale issues #1/#4/#6/#8, link Known Issues → backlog, annotate claims the audit contradicts).
2. RAG evaluation golden-question set + methodology as `docs/modules/rag-evaluation.md` (GAP-3 docs half; the runner `.py` waits for the CI filter fix).
3. Backlog entries updated to match (KI-4 wording half, KI-6, GAP-RAG).

## Out of scope

All owner-gated Phase 0 items (BE-1 rotation, AUD-1, AUD-2/CI, PROP-1 choice); every code/config fix; anything matching a CI path filter.

## Done criteria

README claims match audited reality; eval doc committed with a usable golden set; backlog consistent; per commit secret scan + path check (all deploy-inert); clean tree.

## Status

- 2026-10-22 — Started.
- 2026-10-22 — **Complete** in 4 commits: plan; README accuracy (node-pty claim removed, issues #1/#4/#6/#7/#8 corrected against audit evidence, caveats on the stale "Completed Fixes" claims, Known-Issues table now links `docs/backlog.md` as the live tracker); `docs/modules/rag-evaluation.md` (methodology, metrics incl. reuse of the NLI monitor, 20-question golden set, thresholds — the runner `.py` deferred until AUD-2 per FE-8); backlog (QW-1 Done, KI-4/KI-6/GAP-RAG updated) + AGENTS.md docs map. All changed paths deploy-inert (`README.md`, `AGENTS.md`, `docs/**`); secret scans clean. Not pushed. Next agent-executable work is owner-gated: PROP-1 option choice, BE-1 rotation, AUD-1/AUD-2 approvals.
