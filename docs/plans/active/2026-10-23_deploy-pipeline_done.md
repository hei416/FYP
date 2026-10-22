# 2026-10-23 — Container deploy pipeline (files only)

**Goal:** replace the zip-deploy CI with the DEPLOY-1 container pipeline as files only —
nothing run, triggered, provisioned, pushed, or logged into.

**Inputs (owner):** DEPLOY-1 = recommended default (ghcr.io → Azure Container Apps +
Cloudflare Pages + Neon) — adopted from `docs/reports/deploy-options-2026-10-22.md`
§Recommended default, **decision-log wording pending owner confirmation** (below).
Docker smoke test: **not run yet** (Docker not installed locally). Base:
`integration/container-readiness` (**not merged** into main). Old CI repair `c9e78c7`
**dropped**, not merged.

**Branch:** `ci/container-deploy-pipeline` (worktree `~/FYP-deploy-pipeline`), off
`integration/container-readiness` @ `8290fc3`. Backup tag:
`backup/2026-10-23-pre-deploy-pipeline`.

**Scope / files:**
- `.github/workflows/build-backend-image.yml` (new) — ghcr.io image build+push;
  `workflow_dispatch` + `v*` tags only; pinned action versions; job-scoped
  `contents: read` / `packages: write`; SHA-tagged images; auth = ephemeral
  `GITHUB_TOKEN`; optional `BAKE_HF_MODELS` input (tag builds always bake).
- `.github/workflows/deploy-frontend-pages.yml` (new) — manual-only Cloudflare Pages
  deploy; API URL from repo variable `REACT_APP_API_BASE` (guarded), project from
  `CF_PAGES_PROJECT`; secrets by name only (`CLOUDFLARE_API_TOKEN`,
  `CLOUDFLARE_ACCOUNT_ID`).
- Old `backend.yml` / `frontend.yml` → archived verbatim to
  `docs/_archives/2026-10-23_zip-deploy-workflows/` + README note.
- `docs/OPS.md` — §Deploy mechanics (latent) replaced by §Deploy runbook: secret/var
  names, first-deploy order, health check, one-command rollback, `CORS_ORIGINS`,
  hand-run DB migrations; two stale latent-pipeline references fixed.
- `docs/plans/active/first-deploy-readiness.md` — #5 note refreshed, #6 Dropped
  (superseded), #12 Done, #15 Done, #16 Dropped, #17 + container-CI row updated.
- `docs/backlog.md` — AUD-2 Dropped (superseded), DEPLOY-1 Decided.
- `AGENTS.md` — deploy-triggers section rewritten (no push triggers on this branch;
  `v*` tags are a trigger now; `main` still armed), deploy line updated.

**Done-criteria:** files written and valid YAML; no network side effects; secret scan
clean per commit; clean tree; decision log NOT written (owner confirms wording first). ✅

## Proposed decision-log entry (owner confirms before it is written)

> **2026-10-23 — DEPLOY-1: deployment method = container pipeline.**
> Backend ships as a container image on ghcr.io (SHA-tagged, built by
> `build-backend-image.yml` on manual dispatch or `v*` tag — never on push to main),
> deployed manually to Azure Container Apps (consumption, scale-to-zero); frontend is a
> static CRA build deployed manually to Cloudflare Pages; database is Neon free
> Postgres. Reason: ~$0–10/mo idle cost, cleanest rollback (ACA revisions / Pages
> deploy history), retires `startup.sh`/Oryx and the zip-layout fragility; per the
> recommended default in `docs/reports/deploy-options-2026-10-22.md`. The zip pipeline
> is archived (`docs/_archives/2026-10-23_zip-deploy-workflows/`) and the AUD-2 zip
> repair (`c9e78c7` on `fix/terminal-and-ci`) is dropped unmerged. Deploys are
> owner-run by hand per OPS.md §Deploy runbook; DB migrations by hand, never CI.

## Status (handoff)

- **Done:** both workflows written + YAML-validated offline (Ruby psych;
  `yaml.safe_load` unavailable — no PyYAML/venv on this machine, actionlint not
  installed, nothing installed per rules). Old workflows archived. OPS runbook,
  readiness, backlog, AGENTS.md updated. 3 commits, clean tree, nothing pushed.
- **Not done / owner:** confirm the decision-log wording above (then it gets appended
  to `docs/strategy/decision-log.md`); Docker smoke test (readiness #10/§Container —
  no Docker locally; image size / cold start / RAM still unmeasured); set GitHub
  secrets+variables and ACA secrets (names: OPS.md §Deploy runbook); provision
  Neon/ACA/Pages; Azure half of readiness #1 (`docs/reports/azure-inventory-2026-10-23.md`);
  BE-1 rotation (urgent — repo public); merge/review of this branch, then delete the
  stale Azure GitHub secrets.
- **Verified after writing (fetch + gh, read-only):** `main` was merged + pushed at
  `6420455` by a parallel session (includes this branch's base `8290fc3`) and both old
  workflows are now `disabled_manually` on GitHub — no deploy fired. This branch is
  3-ahead / 3-behind `origin/main`; expect small doc conflicts (AGENTS.md, backlog,
  readiness) at merge. Stale "main still armed" wording amended in commit 4.
- **Watch-outs:** pushing a `v*` tag now triggers an image build — don't tag until
  intended; `wrangler` pinned only to major 3 (pin exact at first use); action pins are
  release tags, tighten to commit SHAs if wanted; `CI: false` in the frontend build is
  deliberate (FE-12) until CRA warnings are cleaned.
