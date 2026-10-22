# Single-process collapse — retire terminal-service, serve the SPA from FastAPI

**Branch:** `chore/single-process-collapse` · **Worktree:** `/Users/pandawork/FYP-single-process`
**Owner decision (this session):** collapse to **one process**, accepting the loss of interactive stdin.

## Goal

Reduce the runtime from 3 services (FastAPI :8000, CRA :3000, Node terminal-service :3001) to
**one deployed process**: FastAPI serves the built React SPA and the API on a single port, and all
Java execution goes through the existing Paiza path (`POST /api/run-code`).

## Why this is possible

- `Compiler.js:443` already branches `if (TERMINAL_WS) … else handleHttpRun()` — the HTTP/Paiza path
  is the working default and needs no new backend code.
- `terminal-service/server.js` (120 lines) adds exactly one capability the Paiza path lacks:
  **live stdin** for `Scanner`. Owner accepted dropping it.
- `ENABLE_TERMINAL` already defaults to `false` (AUD-1), so the ws path is off in practice today.
- `InteractiveTerminal.jsx:40` hardcodes `ws://localhost:3001`, bypassing both `ENABLE_TERMINAL`
  and `routers/terminal.py` — Playground's interactive mode is **already broken in any deployment**.
  Removing it closes a latent bug rather than removing working behaviour.

## Scope — files to touch

**Backend**
- `backend/main.py` — drop the `terminal` router from the import + registration list; mount the SPA
  (`StaticFiles` + SPA fallback) **after** all API routers, guarded so a missing build dir is a no-op.
- `backend/core/config.py` — add `FRONTEND_BUILD_DIR`; remove `ENABLE_TERMINAL`.
- `backend/routers/terminal.py` — delete (ws proxy to the retired service).
- `backend/tests/test_terminal_proxy.py` — delete (tests the removed gate).
- `backend/tests/` — add a test asserting the SPA mount does not shadow API routes.

**Frontend**
- `frontend/package.json` — `start` back to plain `react-scripts start` (drop `concurrently`).
- `frontend/src/Compiler.js` — remove `TERMINAL_WS` / `handleWsRun` / ws stdin; always use the HTTP path.
- `frontend/src/Playground.js` — remove the `InteractiveTerminal` branch.
- `frontend/src/components/InteractiveTerminal.jsx` — delete.

**Root / ops**
- `terminal-service/` — delete the folder.
- `startup.sh` — remove the background `npm install && node server.js` block.
- `docker-compose.yml` — repair (`working_dir` + `cd` resolve to `/app/frontend/frontend` today;
  no `REACT_APP_API_BASE` passed) and drop the terminal service.
- `env.example` — drop `REACT_APP_TERMINAL_WS`.
- **Not touched:** `docker-compose.container.yml`, `backend/Dockerfile` — tied to the undecided
  DEPLOY-1 and to `ci/container-deploy-pipeline`; restructuring them now creates a merge collision.

**Docs**
- `docs/OPS.md` — one run path; remove the terminal-service row.
- `AGENTS.md` (root), `backend/AGENTS.md`, `backend/routers/AGENTS.md`, `frontend/AGENTS.md`.
- `docs/backlog.md` — close AUD-1 / KI-7 / FE-2 under this decision.
- `docs/strategy/decision-log.md` — draft entry; **wording needs owner confirmation** before it counts.

## Deploy-filter check (AGENTS.md verification step 2)

Changed paths match `backend/**`, `frontend/**`, `terminal-service/**`, and `startup.sh` — i.e. **both**
CI deploy filters. Both workflows are `disabled_manually`, but the rule stands: **commit locally only,
never push.** The owner pushes if and when they choose.

## Done-criteria

1. `python -c "import main"` from `backend/` succeeds.
2. `cd frontend && npm run build` succeeds; `CI=true npm test -- --watchAll=false` stays green.
3. `python -m pytest tests/ -q` (offline subset) green, with the terminal test removed.
4. No reference to `3001`, `terminal-service`, `ENABLE_TERMINAL`, or `REACT_APP_TERMINAL_WS`
   survives outside `docs/` history.
5. Backend serves `/` from `frontend/build` when present, and API routes still win.
6. Clean tree, Status block updated.

## Status

**Done — awaiting owner review. Local only; nothing pushed.**

Branch `chore/single-process-collapse`, worktree `/Users/pandawork/FYP-single-process`, based on
`main` @ `4211ee4`. Five commits: backend SPA mount, frontend single execution path, terminal-service
deletion + compose repair, docs, and the API-base single source of truth.

### Verified

- `python -c "import main"` — 120 routes, 12 routers, **no `/ws/terminal`**. Ran under a Python 3.11
  venv borrowed from the `FYP-restructure` worktree (this machine's system `python3` is 3.9 and no
  `.venv` exists at the repo root).
- `pytest tests/ -q` (offline subset) — **42 passed**, including 9 new SPA-mount tests. Green both
  with and without `frontend/build` present.
- `npm run build` — compiles (warnings only, all pre-existing). `CI=true npm test` — 6 passed.
- `REACT_APP_API_BASE= npm run build` — bundle contains no absolute API host; the backend serves it
  with only relative asset references.
- **End-to-end single-process proof:** with the real `frontend/build`, the backend serves `/` as
  index.html, serves the hashed `main.*.js` bundle (1.73 MB), falls back to index.html on
  `/lessons/3`, and still answers `/health`, `/api/status`, `/api/run-code`, `/docs`, `/openapi.json`.
  A `%2e%2e` traversal returns index.html, not `/etc/passwd`.

### Not verified

- `docker-compose.yml` — repaired by inspection and YAML-parsed, but **Docker is not installed here**,
  so the stack was never brought up.
- `startup.sh` — unverifiable without Azure (unchanged in kind from its pre-existing unverified state).

### Regression found and fixed during the work

`test_unhandled_exception_returns_generic_500` started failing once a local `frontend/build` existed:
it registers a throwaway route at runtime, and the SPA catch-all — registered last — shadowed it.
Fixed by pinning `FRONTEND_BUILD_DIR` to a nonexistent path in that module. The general rule now
holds: **any route added after app import is shadowed by the catch-all.** All real routers register
before it.

### Second pass — the API base (would have made the collapse non-functional)

The first pass shipped a backend that serves the SPA, but every `fetch` still resolved through 17
duplicated `process.env.REACT_APP_API_BASE || 'http://localhost:8000'` fallbacks, and
`frontend/.env.production` bakes in `https://codetutor-fyp-hei.azurewebsites.net` — 22 occurrences in
the built bundle. A deployed single process would have served a page that called a different host.

Fixed by `frontend/src/apiBase.js`, now the single source of truth (closes **GAP-11**): the env var
when set, `http://localhost:8000` when the page is on the CRA dev port, **same origin** otherwise.
All 17 call sites and the `NLIStatusBadge` default parameter route through it.

Verified: `REACT_APP_API_BASE= npm run build` produces a bundle with **zero** absolute API hosts, and
the backend serves it with only relative asset references. A default build still pins the Azure host —
clearing that is **SP-4**, owner action, because `.env*` is off-limits to agents.

### Left for the owner

- **SP-4 (blocking for deploy)** `frontend/.env.production` pins `REACT_APP_API_BASE` to the stale
  Azure host. Until it is cleared, a production build calls that host rather than the origin serving
  it, and single-process mode does not work. One-line owner fix; agents cannot touch `.env*`.
- **SP-1** `frontend/.env.development` / `.env.production` still set `REACT_APP_TERMINAL_WS`. Agents
  must not touch `.env*` (hard rule 3). Dead but harmless.
- **SP-2** `backend/Dockerfile` does not copy `frontend/build`, so a container built from it runs
  API-only. Batch with DEPLOY-1 — and note this decision may retire the separate Cloudflare Pages
  frontend that `ci/container-deploy-pipeline` assumes.
- **SP-3** `.github/workflows/backend.yml` still filters on the deleted `terminal-service/**`.
  Left alone: agents never edit CI.
- Decision-log entry wording (2026-10-23) marked *to confirm*.

### Merge note

`main` moved during this session — another session landed the backend root tidy
(`core.database`, `services/rag_system.py`). This branch is based on `4211ee4` and will need a merge;
the overlap is `backend/main.py` imports and `AGENTS.md`'s "Where things live" table.
