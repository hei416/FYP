# Deployment-history evidence — 2026-10-22 (read-only)

Context: the owner stated on 2026-10-22 that the application has **never been deployed online** — that the Azure App Services and the GitHub Actions deploys were never live in production. This report records what the repo and read-only GitHub queries say, so the owner can confirm or refine the statement. **Nothing was triggered, re-run, or touched in Azure.** Sources: local git history, workflow files, `gh run list` / `gh run view` / `gh api` GETs.

## Owner statement (recorded as a statement, not as verified)

> The application has NEVER been deployed online. The Azure App Services and the GitHub Actions deploys were never live in production.

## What the evidence shows (verified read-only)

1. **The workflows target concrete Azure resources**: App Services `codetutor-fyp-hei` (backend) and `codetutor-frontend-hei` (frontend), resource group `codetutor-rg`, health URL `https://codetutor-fyp-hei.azurewebsites.net/health`; secrets `AZURE_CREDENTIALS`, `DATABASE_URL`, `SECRET_KEY` are referenced.
2. **The deploy workflows really ran — 408 times** (GitHub Actions API total), spanning at least 2026-03-06 (first workflow commits) through 2026-04-21. The last 100 runs (2026-04-03 → 2026-04-21): backend 46 success / 20 failure / 1 cancelled; frontend 15 success / 17 failure / 1 cancelled.
3. **Dozens of runs concluded "success", including the `az webapp deploy` job.** A successful `az webapp deploy` requires valid `AZURE_CREDENTIALS` and an **existing App Service** at run time. This contradicts the readings "the workflows never ran" and "the App Services were never created".
4. **Run success did not prove a working app.** In the Mar–Apr 2026 workflow versions the deploy was `--async` and the health poll had `continue-on-error` (commit 0b3d5a2) and could validate the *previous* build (audit FE-7). A green run therefore does not establish that the app was ever healthy or served users.
5. **The pipeline was failing at last activity.** Last successful backend run: 2026-04-16; last successful frontend run: 2026-04-17. Every later run through 2026-04-21 failed; the commits of those days are titled "fix deployment problem".
6. **Zero workflow runs since 2026-04-22**, even though commits matching the deploy path filters (`.py` changes, dated 2026-04-22, plus a README push dated 2026-07-26) are on `origin/main`. Both workflows show state "active" today. Why no runs fired is **unverifiable** with the current token (HTTP 403 on the Actions-permissions and secrets APIs); plausible causes include Actions/billing being disabled at the time — owner knows.

## Unverifiable from the repo (owner or Azure portal only)

- Whether the deployed app was **ever actually reachable/healthy/used** (see point 4) — the owner's "never live in production" is consistent with the evidence in this weaker sense.
- Whether the App Services, the Azure Postgres, and the GitHub secrets **still exist today** (secrets listing: HTTP 403). If they do, a push to `main` could still start a real deploy and incur cost.
- Why no workflow run has fired since 2026-04-22.

## Conclusion

The strong form of the statement ("App Services never created / deploys never happened") is **contradicted** by CI history: real deploys to real App Services succeeded in March–April 2026. The weaker form — **the app was never live in the sense of a working production instance serving users** — is consistent with the evidence (broken health validation, failing final runs, abandonment after 2026-04-21) and cannot be verified either way from the repo. The owner anticipated corrections of this kind ("a demo instance existed once" / similar); **owner confirmation requested**. Until then, agent docs treat the workflows as **latent but possibly armed** and the no-push rule stands.
