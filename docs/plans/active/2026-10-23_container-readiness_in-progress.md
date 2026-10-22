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

- **State: COMPLETE — all planned commits landed, every per-commit check green. Awaiting owner review/merge. Never pushed.**
- Docker: **not installed** on this machine (checked: docker, colima, podman, orbstack, /Applications/Docker.app — none). Image was NOT built; exact build/run/smoke commands are documented in docs/OPS.md §Container and below in §Smoke test commands.
- torch/transformers bump: deferred (offline verification impossible); note added to audit FE-17.
- CI path filters: backend/frontend commits here match the latent filters (`backend/**`, `frontend/**`) — irrelevant while unpushed; owner must keep the no-push rule until DEPLOY-1 + readiness #1/#2 are resolved.

### Verification log (per commit)

See git log; each commit message lists its changed paths. All commits passed: secret scan clean, import main OK, route set 120 (121 for commits after SEC-14/16? — no: route count unchanged, see notes), offline pytest green (21 → 26 tests by the end), vectorstore sha256 10/10 identical, clean tree. Frontend commits additionally: `npm run build` green, `npm test` green (after FE-16).

### Smoke test commands (for the owner, once Docker is available)

Documented in docs/OPS.md §Container quickstart; summary: `docker build -t codetutor-backend backend/` (add `--build-arg BAKE_HF_MODELS=1` to bake models), `docker compose -f docker-compose.container.yml up`, then `curl localhost:8000/health` and `curl localhost:8000/openapi.json | jq '.paths | keys | length'`.
