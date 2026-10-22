# Container readiness (host-agnostic) — 2026-10-23

Branch: `integration/container-readiness` (worktree `/Users/pandawork/FYP-container-readiness`), base = `refactor/backend-and-prebuild-fixes` (d277bd2) merged with `docs/deploy-options` (5e72cc1). Backup tags: `backup/pre-container-2026-10-23-refactor`, `backup/pre-container-2026-10-23-deploy-options`. The CI repair commit c9e78c7 on `fix/terminal-and-ci` stays on hold — NOT merged here.

**Scope (owner-approved):** DEPLOY-1 (host choice) is still undecided. Only work that is portable across container hosts: Dockerfile, .dockerignore, compose-based local smoke test, pre-deploy audit items (SEC-14, SEC-16, FE-16, fetch_missing_docs stale path), docs. **No host chosen, no cloud connection, no push, no registry, no workflow edits.**

## Goal / done-criteria

1. `backend/Dockerfile` (pinned Python base, non-root, CPU-only torch if behaviour-neutral, HF models bakeable via build arg) + `.dockerignore`; all config from env; `ENABLE_TERMINAL` default off; no secrets in image; `/health` usable as probe.
2. Image built + smoke-tested against a throwaway compose Postgres **if Docker exists locally** — otherwise exact commands documented. (Docker is NOT installed on this machine — commands documented instead; see Status.)
3. SEC-14 login rate limit, SEC-16 password policy, FE-16 `npm test` repair, `scripts/fetch_missing_docs.py` stale path. torch/transformers bump only if verifiable offline, else a note.
4. Docs: AGENTS.md, docs/OPS.md (container run + env table, placeholders only), docs/modules, audit statuses, "container readiness" section in first-deploy-readiness.md with rows now Done.

## Rules in force

Never push/merge/deploy; no `gh workflow run`; no Azure/registry/live resources; never read/edit `.env*` or secrets; never print DB credentials; do not touch `.github/workflows/`. One finding per commit; blocking secret scan before each commit; after each commit: `python -c "import main"` (from backend/), offline pytest suite, route set = 120, vectorstore sha256 10/10 vs baseline, `git status` clean; `npm run build` for frontend changes.

## Verification baseline (captured on the merge commit, before any change)

`import main` OK; route set 120; offline pytest **21 passed**; vectorstore sha256 recorded (10 files) — matches the restructure session's "identical 10/10" state; clean tree. Venv reused: `/Users/pandawork/FYP-restructure/.venv` (Python 3.11.15).

## Planned commits

| # | Commit | Files |
|---|---|---|
| 1 | this plan file | docs/plans/active/ |
| 2 | backend/Dockerfile + backend/.dockerignore + root .dockerignore | backend/, root dotfile |
| 3 | compose: throwaway local Postgres profile for container smoke test (placeholders only) | docker-compose.yml or docker-compose.container.yml |
| 4 | SEC-14 login/register rate limit + tests | backend/routers/auth.py, backend/tests/ |
| 5 | SEC-16 password policy + tests | backend/models.py or routers/auth.py, backend/tests/ |
| 6 | FE-16 repair `npm test` | frontend/src/App.test.js (+ config if needed) |
| 7 | fetch_missing_docs.py stale path | backend/scripts/ |
| 8 | docs: OPS.md, AGENTS.md, modules, audit statuses, readiness section | docs/, AGENTS.md |

torch/transformers bump: **deferred with a note** — verifying new ML wheels requires pip network installs and model-behaviour checks that are not possible offline; recorded in the audit/OPS notes instead.

## Status

- **State: COMPLETE — 9 commits landed, every per-commit check green. Awaiting owner review/merge. Never pushed; no registry, no cloud, no workflow edits.**
- Docker: **not installed** on this machine (checked: docker, colima, podman, orbstack, /Applications/Docker.app — none). Image was NOT built; exact build/run/smoke commands: docs/OPS.md §Container.
- Unplanned finding fixed en route (own commit): **GAP-14** — `sentence_transformers` imported by `rag_system.py` but never pinned in `requirements.txt`; pinned 2.7.0 (+Pillow 10.4.0), import-verified offline. Without it, any container built from the manifest would run with RAG degraded.
- torch/transformers bump (FE-17 remainder): **deferred** — unverifiable offline (network wheel installs + model-behaviour checks); noted in the audit. Revisit at the first container build.
- CI path filters: the backend/frontend commits here match the latent filters (`backend/**`, `frontend/**`) — inert while unpushed; the no-push rule stays until DEPLOY-1 + readiness #1/#2 are resolved.
- Backlog delta for the owner: SEC-14, SEC-16, FE-16 → Done on this branch (pending merge); GAP-14 new+fixed; DEPLOY-1 unchanged (Needs human).

### Verification log (per commit)

Each commit message lists its changed paths. Every commit passed: blocking secret scan clean, `import main` OK (from backend/), route set identical to baseline (120), offline pytest green (21 tests at baseline → 23 after SEC-14 → 30 after SEC-16; final suite 30 passed), vectorstore sha256 10/10 identical to the baseline recorded before any change, `git status` clean. Frontend commit (FE-16) additionally: `CI=true npx react-scripts test --watchAll=false` 2 suites / 6 tests green, `npm run build` green. Compose/Dockerfile commits: YAML parse check; Dockerfile not buildable locally (no Docker). fetch_missing_docs commit: `py_compile` + path-resolution check (script is a network fetcher — deliberately not executed).

Environment: venv reused from the restructure session (`/Users/pandawork/FYP-restructure/.venv`, Python 3.11.15); frontend `node_modules` cloned (APFS clonefile) from the restructure worktree — `package.json` byte-identical at clone time (the FE-16 commit then changed it: jest config only, no dependency changes, so no reinstall needed).

### Smoke test commands (for the owner, once Docker is available)

Documented in docs/OPS.md §Container; summary: `docker build -t codetutor-backend backend/` (add `--build-arg BAKE_HF_MODELS=1` to bake models, ≈ +0.7 GB), `docker compose -f docker-compose.container.yml up --build`, then `curl -fsS localhost:8000/health` → `{"status":"ok"}` and the openapi path count per OPS.md. Tear down with `down -v` (throwaway DB).

## Close-out

- 2026-10-23 — Branch `integration/container-readiness` merged to `main` (SEC-14/16, FE-16, GAP-14, Dockerfile + smoke stack). Follow-up deploy-pipeline work lives on `ci/container-deploy-pipeline` (unmerged; DEPLOY-1 wording awaits owner confirmation). Filed to `done/`.
