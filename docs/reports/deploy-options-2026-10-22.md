# Deployment options research — 2026-10-22 (docs-only)

Purpose: choose a deployment method for CodeTutor before any CI repair or first deploy. Context: the current method (GitHub Actions zip-deploy to two Azure App Services, Oryx build, `startup.sh` `/tmp` search) has never produced a verified live instance (owner statement + [deployment-evidence-2026-10-22.md](deployment-evidence-2026-10-22.md)), CI has been silent since 2026-04-22, and the audit flags the pipeline itself (FE-2/3/7/8/9/11, GAP-13). Owner profile: student in Hong Kong, small budget, portfolio project that may sit idle for long stretches, no deadline.

**Nothing was changed or deployed. No Azure resource was touched.** Web pricing/limits below were checked against official docs in October 2026 by research subagents; each sourced fact carries its URL. Anything marked *(assumption)* or *(unverified)* is exactly that.

## Repo facts (verified locally, this session)

- **No Dockerfile exists.** `docker-compose.yml` is dev-only: stock `python:3.11-slim` / `node:18` images that `pip install` / `npm install` on every start; its own comment says "local development only".
- **Backend is torch-heavy but CPU-only**: `requirements.txt` has 92 pinned deps incl. `torch==2.2.2`, `transformers==4.40.2`, `faiss-cpu==1.13.2`, the langchain stack, `scipy`. The LLM itself is an **external API** (HKBU GenAI, `core/config.py:16`) — no GPU needed anywhere.
- **Two HF models load at startup** (`main.py` lifespan, thread-pool + 60 s timeout): `all-MiniLM-L6-v2` embeddings (`rag_system.py:15`) and `cross-encoder/nli-deberta-v3-small` (`services/nli_monitor.py:91`). Unless baked into the image/disk, both are **downloaded from Hugging Face on first boot** — this inflates every cold start. *(Model files on the order of a few hundred MB total — assumption, not measured.)*
- **Image/RAM estimate**: installed site-packages with CPU torch typically put the container image at **~2.5–4 GB** and steady-state RAM at **~1–2 GB** *(assumption; GAP-13 flags the same "torch+transformers slug" concern; never measured — readiness #10)*.
- **Vector stores**: 6.4 MB committed FAISS files in `vectorstore/`, loaded from `PROJECT_ROOT/vectorstore` — trivially shippable inside an image.
- **No persistent disk needed**: classroom uploads are stored as bytes in Postgres (`routers/classroom.py:1366`); `PDF_DIR`/`LESSON_DIR` defaults point at directories that don't exist (known backlog item OPS-1).
- **WebSockets**: one endpoint, `/ws/terminal`, **off by default** (`ENABLE_TERMINAL`, AUD-1). WS support is nice-to-have, not a hard requirement, until the terminal is hardened.
- **Health endpoint exists**: `GET /health` (`main.py:596`) — usable as a container health/startup probe as-is.
- **Frontend is a plain CRA static build**: API base baked in at build time via `REACT_APP_API_BASE` (17+ files); currently served by an express `server.js` that CI *regenerates at package time* because the repo copy was deleted (FE-3). Static hosting removes that whole failure mode.
- **Env vars the backend reads**: `DATABASE_URL`, `SECRET_KEY`, `API_KEY` (HKBU), `PAIZA_API_KEY`, `ENABLE_TERMINAL`, `DEBUG_MODE`, `PDF_DIR`, `LESSON_DIR`, `BASE_PATH` (+ tokenizer/MPS tuning vars).
- **`startup.sh` is an Oryx workaround** (locates `main.py` under `/tmp`, antenv dance, `--workers 1`). In any container-based option it is simply **not used** — the Dockerfile's CMD replaces it, which also dissolves the "flat layout" constraint it imposes.

## Comparison

Costs in USD/month, idle→light-use, for backend compute unless noted. "CI effort" = work to get a green pipeline from GitHub Actions (S/M/L). Sources: per-option sections below the table.

| Option | Cost/mo (idle → light) | Free tier fits? | Torch backend fits? | Cold start | WebSockets | CI effort | Rollback |
|---|---|---|---|---|---|---|---|
| (a) App Service B1/B2 + container | ~$15 (B1, tight) / ~$28.50 (B2) + $0 registry (ghcr) | No (F1: 1 GB RAM/storage, 60 CPU-min/day) | B2 yes; B1 1.75 GB marginal | Minutes after idle-out on Basic (no Always On) | Yes | M | Easy: re-point image tag; no slots below Standard |
| (b) Azure Container Apps (consumption) | **~$0** scale-to-zero (free grant) → ~$10 (min-replica 0.5 vCPU/1 GiB) | Yes (grant: 180k vCPU-s + 360k GiB-s + 2M req/mo) | Yes (≤4 vCPU/8 GiB; image ≤8 GB) | **~2–5 min from zero** (image pull + model load; estimate) | Yes | S/M | **Best: revisions + traffic shift** |
| (c) VPS (DO/Vultr/Linode SG, 2–4 GB) + Compose + Caddy | $10–24 flat (everything incl. Postgres on one box) | n/a (Oracle A1 free: 2 OCPU/12 GB ARM — capacity lottery + idle reclamation) | Yes (4 GB comfortable; 2 GB tight + swap) | **None** (always on) | Yes | S/M (SSH deploy) | Easy: re-pull previous tag |
| (d1) Render | $25+ (Standard 2 GB; paid never sleeps) | No (free = 512 MB, spins down) | Yes on paid | ~1 min (free only) | Yes | S | 1-click |
| (d2) Railway | ~$5–15 (Hobby $5 incl. usage; app-sleeping) | No ($1 trial credit) | Yes (~$10/GB-RAM-mo) | Sleep-wake; possible 502 on first hit | Yes | S | Redeploy prior |
| (d3) Fly.io (sin) | **~$3–8** (auto-stop; shared-2x 2 GB $13.39 always-on) | No free tier (trial only) | Yes | **Seconds (machine) + 30–90 s model load** — image cached on host | Yes | S | `fly deploy -i <prev>` / releases |
| (e) Static frontend: Cloudflare Pages / Azure SWA / Vercel / Netlify | **$0** (CF Pages: unlimited static bandwidth; SWA: 100 GB/mo, 250 MB app; Vercel Hobby: 100 GB; Netlify: credit-paused risk) | Yes | n/a | n/a (edge) | n/a | S | Built-in deploy history |
| (f) Postgres: Neon free / Azure Flexible B1ms / on-VPS | $0 (Neon: 1 GB, autosuspend) / ~$23–26 (B1ms EA, 24/7; 12-mo free offer exists) / $0 on VPS | Neon yes; Supabase free pauses after 1 wk idle | n/a | Neon resume ≈ sub-s–seconds | n/a | — | Neon branching (paid) / Azure PITR / pg_dump cron |

### Per-option notes and sources

**(a) App Service, container image instead of zip.** East Asia retail: B1 ≈ $14.60, B2 ≈ $28.50, P0v3 ≈ $79 ([prices.azure.com API](https://prices.azure.com/api/retail/prices); tiers: [azure.com App Service Linux pricing](https://azure.microsoft.com/en-us/pricing/details/app-service/linux/)). F1: 1 GB RAM/storage, 60 CPU-min/day, 5 WS connections ([service limits](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits)) — unusable; whether F1 accepts custom containers at all is *(unverified)*. App Service pulls from any private registry incl. **ghcr.io → $0** ([configure-custom-container](https://learn.microsoft.com/en-us/azure/app-service/configure-custom-container)); ACR Basic would be ~$5.08/mo. Always On requires Standard+; on B1/B2 an idled app restarts with re-pull + model load (minutes). No deployment slots below Standard; rollback = `az webapp config container set` to the previous tag. Keeps current Azure resources/secrets but keeps the always-on cost.

**(b) Azure Container Apps.** Free grant 180,000 vCPU-s + 360,000 GiB-s + 2M requests/mo; East Asia rates ~$0.000024/vCPU-s active ([ACA pricing](https://azure.microsoft.com/en-us/pricing/details/container-apps/)). Scale-to-zero → **~$0 idle**; min-replicas=1 at 0.5 vCPU/1 GiB ≈ $10/mo *(arithmetic from per-second rates; grant split across meters not itemized — assumption)*. Image ≤8 GB on consumption; up to 4 vCPU/8 GiB ([containers doc](https://learn.microsoft.com/en-us/azure/container-apps/containers)). Startup probes tunable to ~4 min — a 60–90 s torch boot fits ([health probes](https://learn.microsoft.com/en-us/azure/container-apps/health-probes)). Ingress: TLS, WebSockets, 240 s request timeout ([ingress](https://learn.microsoft.com/en-us/azure/container-apps/ingress-overview)). Cold start from zero ≈ 2–5 min *(no official figure — estimate)*. Rollback: revisions with traffic splitting — the best rollback story of all options.

**(c) VPS + Docker Compose + Caddy.** DigitalOcean SG: 1 vCPU/2 GB $12, 2 vCPU/4 GB $24 ([DO pricing](https://www.digitalocean.com/pricing/droplets)); Linode/Akamai similar ([Akamai pricing](https://www.akamai.com/cloud/pricing/cpu)); Vultr $10/2 GB *(aggregator only — unverified)*; Hetzner from €5.99 but SG carries premium + small traffic quota *(third-party — unverified)*. Oracle Always Free now **2 OCPU/12 GB ARM** (halved in 2026, [Oracle docs](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)) — torch/faiss ship aarch64 wheels so ARM works, but free capacity is a lottery and **idle instances get reclaimed after 7 days below 20% utilisation** — a real risk for exactly this project. Whole stack (backend + terminal-service + Postgres + Caddy auto-HTTPS) on one box, no cold start, and running it is itself portfolio-credible — but the owner patches the OS and owns uptime/backups.

**(d) Managed platforms.** Render free (512 MB) can't hold torch; paid Standard 2 GB $25/mo never sleeps → ~$32–40 with DB — weakest value ([render.com/docs/free](https://render.com/docs/free)). Railway Hobby $5 incl. $5 usage, ~$10/GB-RAM-mo, app-sleeping exists ([pricing](https://railway.com/pricing), [app-sleeping](https://docs.railway.com/reference/app-sleeping)). Fly.io: no free tier; shared-cpu-2x/2 GB $13.39/mo always-on, **auto-stop/auto-start machines** make mostly-idle ≈ $3–8/mo; restart is seconds because the image stays cached on the host — total wake ≈ model-load time; nearest region **sin** (no hkg) ([fly pricing](https://docs.fly.io/about/pricing), [regions](https://docs.fly.io/reference/regions)).

**(e) Static frontend.** Cloudflare Pages free: unlimited static-asset bandwidth, 500 builds/mo ([limits](https://developers.cloudflare.com/pages/platform/limits/), [pricing](https://developers.cloudflare.com/pages/functions/pricing/)); SPA fallback automatic; excellent HK edge latency. Azure SWA free: 100 GB/mo, 250 MB/environment, `staticwebapp.config.json` for SPA routing ([quotas](https://learn.microsoft.com/en-us/azure/static-web-apps/quotas)). Vercel Hobby: 100 GB, non-commercial only — a student portfolio qualifies ([Hobby plan](https://vercel.com/docs/plans/hobby)). Netlify's new credit model can **pause all sites mid-month** (≈15 GB bandwidth or ~20 deploys) — avoid ([credits](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/)). Any of these kills FE-3 (regenerated `server.js`), FE-9/11 and the frontend App Service cost in one move; CORS (SEC-8) must then allow the static origin, and `REACT_APP_API_BASE` is set in the host's build config.

**(f) Postgres.** Azure Flexible B1ms East Asia ≈ $23–26/mo 24/7 incl. min 32 GB storage (retail API); 12-month free offer for new free accounts still exists ([free-account doc](https://learn.microsoft.com/en-ie/azure/postgresql/flexible-server/how-to-deploy-on-azure-free-account)); stop/start saves compute but auto-restarts after 7 days. Neon free: 1 GB storage, 100 CU-hrs/mo, autosuspend (resume sub-second–seconds), scale-to-zero economics ideal for idleness ([neon.com/pricing](https://neon.com/pricing)) — note classroom uploads are bytea **in** the DB, so the 1 GB cap includes uploaded files. Supabase free **pauses projects after 1 week idle** — wrong fit. On-VPS Postgres: $0, no pausing, but backups are your own `pg_dump` cron (no PITR). *(Neon/Supabase exact Asia region lists unverified; Neon has AWS Singapore per its docs — unverified this session.)*

## Top 2 recommendations

**1. Azure Container Apps (consumption, scale-to-zero) + image on ghcr.io + Cloudflare Pages or Azure SWA frontend + Neon free Postgres — recommended default.**
Why: ~$0–10/mo total for a mostly-idle app (free grant covers light use); stays in the Azure ecosystem the owner already has an account (and possibly student credits and an existing Postgres) in; revisions give the cleanest rollback of any option; the Dockerfile permanently retires `startup.sh`, the Oryx `/tmp` dance, and the zip-layout fragility (FE-3, the flat-layout constraint); probes handle the slow boot.
Risks: **cold start from zero ≈ 2–5 min** (image pull dominates; mitigate by baking HF models into the image, keeping it lean, and setting min-replicas=1 for ~$10/mo during demo/job-hunt periods, 0 otherwise); free-grant accounting across active/idle meters is not fully itemized *(assumption)*; ACA is more moving parts (environment, revisions) than App Service.

**2. Fly.io (sin) + Cloudflare Pages + Neon free — runner-up.**
Why: ~$3–8/mo with auto-stop/auto-start; **much better cold start than ACA** (image cached on host → wake ≈ seconds + the app's own 30–90 s model load); simplest CI (`flyctl deploy` in one Action); `fly releases` rollback.
Risks: leaves Azure entirely (new account, credit card required, existing Azure Postgres/secrets become irrelevant — which is only a risk if readiness #1 reveals usable resources/credits); no HK region (Singapore ≈ 30–40 ms, fine *(assumption)*); usage-based billing needs a spend cap mindset.

Honourable mention: **option (c) VPS** if the owner wants ops experience on the CV — $12–24/mo flat, zero cold start, whole stack incl. Postgres on one box; rejected as default only because it adds OS-patching/backup duties to a no-deadline project, and Oracle's free tier (the $0 variant) has capacity + idle-reclamation risk.

**Not recommended**: keeping zip-deploy (current, demonstrably broken pipeline); Render (paid-only fit, never sleeps, $32–40); Netlify free (pause risk); Supabase free (1-week pause); App Service B1 (RAM too tight) — B2 is fine but $28.50/mo buys always-on the project doesn't need.

## Recommended default + rollback story

Default: **(b) ACA + ghcr + static frontend + Neon**, with this rollback story:
1. Every image pushed to ghcr.io is tagged with the git SHA (and `latest` never deployed by tag alone).
2. ACA creates a new **revision** per image; deploy = shift traffic to the new revision after `/health` passes.
3. Rollback = shift traffic back to the previous revision (one `az containerapp revision` command or portal click) — no rebuild, seconds.
4. Frontend rollback = the static host's built-in deploy history (both CF Pages and SWA keep previous deployments).
5. DB: Neon free has limited history — before any migration, take a manual `pg_dump`; schema changes stay backward-compatible with the previous revision (the revision rollback otherwise lies).

## What each option needs from the repo

Common to **all container options (a/b/c/d)** — none of this exists yet:
- A **`Dockerfile`** (multi-stage: pip install with the CPU-only torch wheel index to keep the image small; copy app + `vectorstore/`; `CMD uvicorn main:app`), plus `.dockerignore` (exclude `frontend/`, `tests/`, `docs/`, `.venv`).
- **Bake the two HF models into the image** (download at build time to a cached dir, set `HF_HOME`) — otherwise every cold start re-downloads them *(size assumption above)*.
- `/health` already exists — wire it as the container health/startup probe.
- **`startup.sh` becomes dead** in container mode; retire it when the method is adopted (do not delete while the latent zip workflows exist).
- **New CI workflows** (build+push image, then platform deploy step) — this is why the existing CI repair on `fix/terminal-and-ci` (AUD-2) is **on hold**: it patches the zip pipeline that a container choice replaces wholesale. Don't merge repairs to a pipeline that's about to be deleted; don't delete the old workflows until the owner answers readiness #1/#2.
- **`PROJECT_ROOT` / layout**: `core/config.py` derives everything from `PROJECT_ROOT` (= repo root in the flat layout). A container fixes paths at `/app`, which *also* makes the proposed `backend/` restructure (proposal decision #9) cheap: the Dockerfile's COPY decides layout, and `PROJECT_ROOT` derivation just needs to match the chosen in-image layout. The old constraint ("moving backend files breaks `startup.sh`") disappears with `startup.sh`.
- Secrets move to the platform's secret store (ACA secrets / fly secrets / VPS `.env` outside git): `DATABASE_URL`, `SECRET_KEY`, `API_KEY`, `PAIZA_API_KEY`; `ENABLE_TERMINAL` stays unset (readiness #5).

Option-specific:
- **(b) ACA**: resource group + ACA environment + app (owner creates); startup probe tuned (e.g. failure threshold ≥ 120 s); scale rule min 0 / max 1.
- **(d3) Fly**: `fly.toml` (auto_stop_machines, min 0), Fly account + card.
- **(c) VPS**: a production `docker-compose.prod.yml` (real builds, not the dev pip-install-on-start), Caddyfile, Postgres volume + `pg_dump` cron, SSH deploy key in GitHub secrets.
- **(e) static frontend**: host build config with `REACT_APP_API_BASE` = backend URL; SPA fallback config (automatic on CF Pages; `staticwebapp.config.json` on SWA); **SEC-8 CORS** must allow the static origin — already a readiness #7 item.
- **(f) Neon**: connection string → `DATABASE_URL`; run `schema_migration.py` against the empty DB (readiness #8 order applies); mind the 1 GB cap given bytea uploads.

Terminal-service: stays **not deployed** anywhere until SEC-2/3/5/6 hardening (AUD-1); in container options it would eventually be a separate container behind the backend proxy — out of scope here.

## Facts vs assumptions

- **From official sources (URLs above)**: all prices, free-tier limits, image/replica limits, probe/ingress behaviour, pause/reclamation policies.
- **Assumptions (mine)**: image size 2.5–4 GB and RAM 1–2 GB (never measured — readiness #10 would settle it); ACA cold start 2–5 min; HF model download size; Singapore latency from HK; Neon free covering current data volume.
- **Unverified**: F1 custom-container support; ACA free-grant split across meters; Vultr/Hetzner exact current prices (aggregators); Neon/Supabase Asia region lists; whether the owner's existing Azure subscription has student credits or the 12-month Postgres free offer available; whether the existing Azure resources still exist at all (readiness #1 — decides whether "keep Azure Postgres" is even an option).

## Status

- **2026-10-22** — Research complete (3 web-research subagents against official pricing/docs + local repo greps). Report written; readiness checklist gained a "deployment method" section; backlog gained DEPLOY-1 (Needs human). **No code, CI, or Azure change. Decision is the owner's.**
