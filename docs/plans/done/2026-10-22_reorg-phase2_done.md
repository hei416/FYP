# Plan: Reorg Phase 2 — archive loose root docs (owner-approved 2026-10-22)

## Goal

Move the loose root report docs and the notebook into `docs/_archives/` with `git mv`, merge `QUICKSTART.md` into `docs/OPS.md` first, fix every path reference, and tidy docs/backlog/plan entries — with zero deploy-triggering paths touched.

## Scope

Branch `reorg/phase2-moves` (worktree `/Users/pandawork/FYP-reorg-phase2`, from `reorg/phase1-scaffolding`). Backup tag `backup/pre-phase2-2026-10-22`.

Files to move (10):

- 8 root reports: `BUG_FIX_REPORT_PHASE1.md`, `CONTENT_OVERLAP_ANALYSIS.md`, `DATA_LEAKAGE_FIX_VERIFICATION.md`, `IMPLEMENTATION_SUMMARY.md`, `LLM_FALLBACK_IMPLEMENTATION_SUMMARY.md`, `PDF_DISPLAY_IMPLEMENTATION.md`, `PDF_DISPLAY_QUICKSTART.md`, `TEXT_HIGHLIGHT_FEATURE.md`
- `QUICKSTART.md` (content merged into `docs/OPS.md` before the move)
- `FYP RAG.ipynb`

Out of scope (owner, 2026-10-22): `schema_migration.py`, `verify_schema.py`, `terminal-service/`, `startup.sh`, any `.py` file, `env.example` rename (owner does it), `.env*`, `vectorstore/`, root `public/`, the `.bak` file, `.github/workflows/`, `frontend/**`, all audit fixes. Never push/merge/deploy.

## Done criteria

All 10 files live in `docs/_archives/` via `git mv` (history preserved, `git log --follow` spot-checked); no remaining broken references; README/backlog/plan entries updated; per commit: secret scan clean, changed paths verified against CI filters, `python -c "import main"` and `python -c "from core import config"` pass in the venv; clean tree; no push.

## Status

- 2026-10-22 — Phase 2 approved by owner. Worktree + branch created from `reorg/phase1-scaffolding` (74880f2); backup tag `backup/pre-phase2-2026-10-22` set.
- 2026-10-22 — **Phase 2 complete** in 5 commits: plan; QUICKSTART→OPS.md merge; 10 `git mv` moves (all R100, history verified via `git log --follow`) + archive README; reference fixes (README KI-10, backlog KI-10→Done, Phase 1 plan filed to done/); this closing entry. Per commit: secret scan clean, no changed path matched a CI filter, `import main` + `from core import config` passed (fresh `.venv`, Python 3.11, requirements.txt). Decided within autonomy: `FYP RAG.ipynb` cells keep their cwd-relative `./java_docs/…` paths — archived content stays frozen; the run-from-repo-root caveat is documented in `docs/_archives/README.md`. Tree clean. **Not pushed, not merged — owner reviews branch `reorg/phase2-moves`.**
