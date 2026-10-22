# Archived 2026-10-23 — zip-deploy workflows (replaced by the container pipeline)

`backend.yml` and `frontend.yml` are the old push-triggered zip-deploy pipelines to the
two Azure App Services (`codetutor-fyp-hei`, frontend). Archived — not deleted — when
DEPLOY-1 adopted the container route (ghcr.io image → Azure Container Apps + Cloudflare
Pages + Neon; decision-log entry pending owner confirmation). Replacements live in
`.github/workflows/build-backend-image.yml` and `deploy-frontend-pages.yml` — both
manual/tag-triggered only; **no workflow fires on push to `main` anymore** once this
branch is merged.

Why archived rather than repaired: the audit's CI repair (AUD-2, prepared as `c9e78c7`
on `fix/terminal-and-ci`) patched this zip pipeline; the owner dropped that commit
2026-10-23 — do not merge it. Files kept verbatim for reference (deploy history
Mar–Apr 2026: `docs/reports/deployment-evidence-2026-10-22.md`).

Note while unmerged: on `main` the old workflows are still live and armed (secrets
exist, Actions enabled — `docs/reports/azure-inventory-2026-10-23.md`); the no-push
rule covers that. After merging, the owner should also delete the dangling secrets
`AZURE_CREDENTIALS`, `AZURE_WEBAPP_PUBLISH_PROFILE`, `AZURE_FRONTEND_PUBLISH_PROFILE`.
`startup.sh` stays at the repo root until the old App Services are retired.
