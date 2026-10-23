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

**HANDED OFF 2026-10-23 — done, unmerged, unpushed, tree clean.** Awaiting owner review.
Next session: read the Merge map below before anything else, and note SP-4 is still open and blocking.

Branch `chore/single-process-collapse`, worktree `/Users/pandawork/FYP-single-process`, based on
`main` @ `4211ee4`. Six commits: backend SPA mount, frontend single execution path, terminal-service
deletion + compose repair, docs, and the API-base single source of truth.

### Verified

- `python -c "import main"` — 120 routes, 12 routers, **no `/ws/terminal`**. Ran under a Python 3.11
  venv borrowed from the `FYP-restructure` worktree (this machine's system `python3` is 3.9 and no
  `.venv` exists at the repo root).
- `pytest tests/ -q` (offline subset) — **43 passed**, including 10 new SPA-mount tests. Green both
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

### Third pass — owner-granted follow-ups (SP-2, SP-3; SP-4 blocked)

- **SP-3 done.** `terminal-service/**` removed from `.github/workflows/backend.yml` under an explicit
  in-session grant that overrides the 2026-10-22 "agents never edit CI" decision; the override is
  recorded in the decision log so the next session does not revert it.
- **SP-2 done, and UNVERIFIED — Docker is not installed here, so the image was never built.** The
  build context stays `backend/` (moving it to the repo root would stop `backend/.dockerignore`
  applying, and that file is what keeps `.env*`, `tests/` and `*.db` out of the image). CI drops the
  SPA into `backend/frontend_build/`, committed as an empty placeholder so a hand-run build still
  succeeds; `FRONTEND_BUILD_DIR=/app/frontend_build` because the code default resolves to
  `/frontend/build` in-image (`PROJECT_ROOT` is `/app`). `main.py` now probes for `index.html` rather
  than the directory, so an empty placeholder degrades to API-only — tested.
- **SP-4 could not be done.** The owner granted the `.env.production` edit, but a tool-level deny rule
  on `.env*` blocks agents from reading or writing the file. Still the one thing standing between this
  branch and a working deployed single process.

### Owner one-liners — SP-1 + SP-4 (run from `/Users/pandawork/FYP-single-process`)

Both edit `frontend/.env.production`, so do them in one pass. Agents cannot run these: the `.env*`
deny rule in `.claude/settings.json` blocks reads and edits, and hard rule 3 blocks committing them
too — the owner stages and commits these two paths.

```bash
sed -i '' '/REACT_APP_TERMINAL_WS/d' frontend/.env.development frontend/.env.production   # SP-1
sed -i '' 's|^REACT_APP_API_BASE=.*|REACT_APP_API_BASE=|' frontend/.env.production        # SP-4
```

The exact key spelling in those files comes from this plan's own notes, never from a file an agent
read — eyeball the result before committing.

**Verification that does not touch `.env*`** (an agent can run this): a plain `npm run build` with no
command-line override — the earlier pass only tested `REACT_APP_API_BASE= npm run build`, which
bypasses the file — then grep the bundle:

```bash
cd frontend && npm run build && grep -c "azurewebsites.net\|3001" build/static/js/*.js
```

Zero hits closes SP-1 and SP-4 empirically. Note the edit matches the `frontend/**` CI deploy filter;
both workflows are `disabled_manually` and nothing is pushed, so this is a commit-message note, not a
gate.

### Left for the owner

- **SP-4 (blocking for deploy)** `frontend/.env.production` pins `REACT_APP_API_BASE` to the stale
  Azure host. Until it is cleared, a production build calls that host rather than the origin serving
  it, and single-process mode does not work. One-line owner fix; agents cannot touch `.env*`.
- **SP-1** `frontend/.env.development` / `.env.production` still set `REACT_APP_TERMINAL_WS`. Agents
  must not touch `.env*` (hard rule 3). Dead **on this branch** — verified 2026-10-23, zero code
  references outside `docs/`. **Correction:** an earlier note here called it "dead but harmless"
  unconditionally; that holds only after this branch merges. On `main`,
  `frontend/src/components/Compiler.js:53/386/443` still reads the var and `:443` branches on it, so
  removing it there changes behaviour (local dev falls back to the HTTP/Paiza path). Do SP-1 and
  SP-4 together **in this worktree**, not on `main`.
- **DEPLOY-1 reconciliation** — `ci/container-deploy-pipeline` assumes a separate Cloudflare Pages
  frontend, which this decision retires. Someone has to reconcile the two before that pipeline lands.
- **Build the image once Docker is available** — SP-2 is inspection-only today.
- Decision-log entry wording (2026-10-23) marked *to confirm*.

### Merge map — measured, not guessed (dry run 2026-10-23, aborted)

`main` moved **7 commits** during this session and is now at `0303156`. This branch is 7 ahead / 7
behind. The big one is the **frontend src restructure merge**: 40 files moved into
`pages/ components/ services/ utils/ data/`, which is exactly the set of files this branch edited.

A trial `git merge main` (run in a throwaway worktree, aborted, nothing kept) produces **6 conflicts**:

| File | Kind | What to do |
|---|---|---|
| `frontend/src/components/Compiler.js` | content, 1 hunk | Keep this branch's version — the ws run path, `stripAnsi` and the live stdin form are deliberately gone |
| `frontend/src/pages/Playground.js` | content, 1 hunk | Keep this branch's version — `InteractiveTerminal` is deliberately gone |
| `frontend/src/classroomService.js` | **modify/delete** | Take main's delete. Main made `services/classroomService.js` canonical (this branch edited the dead flat duplicate); then apply the `apiBase` change to the canonical file, which still has the old `REACT_APP_API_BASE \|\| 'http://localhost:8000'` fallback |
| `backend/tests/test_security_fixes.py` | content | Both sides edited; keep both — main's path updates plus this branch's `FRONTEND_BUILD_DIR` pin |
| `docs/backlog.md` | content | Merge both sets of entries |
| `frontend/AGENTS.md` | content | Merge both |

**Then the part the merge will not flag, because it resolves cleanly and is still wrong:** 16 files
now sit one directory deeper but still `import … from './apiBase'`. After resolving, run:

```bash
# from frontend/src — components/ (7), pages/ (6), services/ (3)
grep -rl "from './apiBase'" components pages services | xargs sed -i '' "s|from './apiBase'|from '../apiBase'|"
```

Consider moving `src/apiBase.js` to `src/services/` to match the new structure — if you do, fix all
17 import paths accordingly. Then re-verify: `npm run build`, `CI=true npm test`, and the backend
suite. **`backend/main.py` did not conflict** despite both sides touching it.

### Old merge note

`main` moved during this session — another session landed the backend root tidy
(`core.database`, `services/rag_system.py`). This branch is based on `4211ee4` and will need a merge;
the overlap is `backend/main.py` imports and `AGENTS.md`'s "Where things live" table.
