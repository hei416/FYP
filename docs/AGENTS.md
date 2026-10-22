# docs/ — all project documentation

One source of truth per topic: info lives in the deepest file that fully covers it; other files **link, never copy**. Everything under `docs/` is deploy-inert (no CI path filter matches it).

## Map

| Path | What | Rules |
|---|---|---|
| `OPS.md` | runbook: setup, run, test, container, deploy mechanics | keep commands here, not duplicated elsewhere |
| `modules/` | per-module deep guides (routers, RAG pipeline/eval, playground, classroom, frontend) | the per-folder `AGENTS.md` files link here for detail |
| `plans/active/` | one file per task: `YYYY-MM-DD_<topic>_<status>.md` with a **Status block** (the handoff note — update it before stopping) | move to `plans/done/` when finished |
| `backlog.md` | Ready / Waiting / Needs human / Unclear / Parked / Done | one task per entry; keep under 150 lines |
| `strategy/decision-log.md` | decisions | **append-only; entries only with owner-confirmed wording** |
| `reports/` | dated point-in-time reports (audits, inventories, evidence) | never rewrite — supersede with a new dated file |
| `_archives/` | retired docs | never overwrite approved docs: new version here, dated |

## Rules

- A task is not done until the docs it affects are updated.
- Stale or wrong doc: fix it, or flag it in your task's plan file.
- New purposeful folder in the repo = new `AGENTS.md` in it (short: purpose, rules, commands, boundaries).
