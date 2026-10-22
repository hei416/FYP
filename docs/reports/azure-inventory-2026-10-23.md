# Azure / GitHub inventory — 2026-10-23

Read-only inventory for readiness rows #1–#3 (`docs/plans/active/first-deploy-readiness.md`).
Run from the owner's dev machine, operator present. No mutations; no secret **values**
queried or logged (names only).

## TL;DR

- **Azure: now VERIFIED** (second pass, later the same day — see §Azure (verified)).
  The owner directly authorised installing and using `az` for this, overriding hard
  rule 2 for read-only Postgres/inventory queries. **The subscription is `Disabled`**:
  the resources all still exist but are deactivated, which is why the hosted Postgres
  times out. The original "could not be queried" pass is kept below as §Azure
  (superseded) for the audit trail.
- **GitHub: fully verified.** Repo `hei416/FYP` is **PUBLIC**. Actions is **enabled**,
  both deploy workflows are **active**, and all 5 deploy secrets still exist.
  The workflows are latent, not dead: a push to `main` matching a path filter would
  attempt a real Azure deploy today.
- **CI silence since 2026-04-22 is explained** (readiness #2): the only push since then
  is `23c472b` (2026-10-22), which touched **only `README.md`** — a path neither
  workflow's filter matches. Nothing was disabled; nothing failed silently.
- **BE-1, as re-scoped by the second pass:** the repo is public **now**, and the old
  Postgres admin password sits in public git history. The server **does** still exist —
  but it is deactivated with the subscription, so the credential is not exploitable
  today and rotation is impossible (`ReadOnlyDisabledSubscription`). It becomes
  same-day urgent the moment the subscription is restored, alongside narrowing the
  wide-open firewall rule (backlog AZ-2).

## GitHub (verified 2026-10-23)

### Repository

| Fact | Value |
|---|---|
| Repo | `hei416/FYP` |
| Visibility | **public** |
| Default branch | `main` |
| Last push | 2026-10-22T18:20:29Z (`23c472b`, README.md only) |
| Archived | no |

### Actions / workflows

- Repo-level Actions permissions: `enabled: true`, `allowed_actions: all`.
- `Deploy Backend to Azure App Service` (`backend.yml`) — **active**.
- `Deploy Frontend to Azure App Service` (`frontend.yml`) — **active**.
- Last 20 runs: all between 2026-04-14 and 2026-04-21; backend runs mostly
  **failure** (last success 2026-04-16), last frontend run success 2026-04-17.
  No runs at all after 2026-04-21.
- **Why no runs since (readiness #2):** every commit up to `71d2662` (pushed
  2026-04-21/22) fired the workflows; the single push since — `23c472b`
  (authored 2026-07-26, pushed 2026-10-22) — changed only `README.md`, which matches
  neither filter (`**.py`, `requirements.txt`, `startup.sh`, `routers/**`, … /
  `frontend/**`, `src/**`, `public/**`, `package.json`, …). So CI was never broken
  or disabled; it simply was never triggered. **Consequence:** the no-push rule is
  doing real work — a push touching any matching path would start a deploy attempt
  with the stored credentials.

### Secrets and variables (names only — values never queried)

Repo secrets (5):

| Name | Last updated |
|---|---|
| `AZURE_CREDENTIALS` | 2026-03-06 |
| `AZURE_FRONTEND_PUBLISH_PROFILE` | 2026-03-06 |
| `AZURE_WEBAPP_PUBLISH_PROFILE` | 2026-03-06 |
| `DATABASE_URL` | 2026-03-12 |
| `SECRET_KEY` | 2026-04-03 |

Repo variables: **none**.

## Azure (verified 2026-10-23, second pass)

Owner authorised `az` directly ("can you use cli to handle the azure situation for me"),
scoped to the Postgres server; `az` 2.91.0 installed via Homebrew, owner ran `az login`.
**All commands below were read-only** — no deploy, no `gh workflow run`, no App Service
settings or publish profiles read. (Writes are impossible anyway: Azure refuses them,
see the error quoted below.)

### Subscription — the headline

| Fact | Value |
|---|---|
| Name | Azure for Students |
| ID | `<subscription-id>` |
| Tenant | Hong Kong Baptist University (`lifehkbueduhk.onmicrosoft.com`) |
| User | `<owner HKBU account>` |
| **State** | **`Disabled`** |
| Quota / spending limit | `AzureForStudents_2018-01-01` / limit `On` |

Any write attempt returns:

```
(ReadOnlyDisabledSubscription) The subscription '<subscription-id>' is disabled and therefore
marked as read only. You cannot perform any write actions on this subscription until
it is re-enabled.
```

A disabled subscription deactivates every resource in it. The usual cause for this
offer is the 12-month term ending or the US$100 credit running out; `az` cannot
distinguish the two, and cannot fix either — re-enabling is a **billing action in the
account portal** (renew the student offer, or convert to pay-as-you-go).

### Resources (all deactivated by the above)

| Resource | Group | Detail | State |
|---|---|---|---|
| `fyp-postgres-db` | `fyp-rg` | PG 16, Burstable `Standard_B1ms`, 32 GiB, France Central, AZ 2 | **Disabled** |
| `codetutor-fyp-hei` | `codetutor-rg` | App Service (backend) | **AdminDisabled** |
| `codetutor-frontend-hei` | `codetutor-rg` | App Service (frontend) | **AdminDisabled** |
| `codetutor-plan` | `codetutor-rg` | App Service plan, **B1 Basic** | Ready |
| `fyp-backend-plan` | `fyp-rg` | App Service plan, **B1 Basic** | Ready |
| `comp4117-fyp-api` | `fyp-rg` | older app, unrelated to CodeTutor | — |

Resource groups present: `fyp-rg`, `codetutor-rg`, `COMP3047`, `4117_group`,
`rg-cosmos-hw`, plus the auto-created `DefaultResourceGroup-*`. The CodeTutor stack is
**split across two groups** (`fyp-rg` holds the DB, `codetutor-rg` the web apps) —
worth knowing before any `az group delete`.

### Postgres detail

| Fact | Value |
|---|---|
| FQDN | `fyp-postgres-db.postgres.database.azure.com` (public A record) |
| Admin login | *(redacted — public repo; see the Azure portal)*; password auth enabled, Entra auth disabled |
| Public network access | **Enabled** |
| Firewall rules | **one**, created 2026-03-12, permitting **all IPv4** |
| Backup | 7-day retention, geo-redundant **off** |
| HA | Disabled |

The firewall rule is a standing finding — backlog **AZ-2**. It must be narrowed before
the server ever accepts traffic again, together with the AUD-0/BE-1 password rotation.

### Cost

**Two B1 Basic App Service plans** (≈US$13/mo each) plus the B1ms Postgres
(≈US$13–16/mo + storage) would be roughly US$40–45/mo if running — *list-price
estimate, not a billing query*. While the subscription is
`Disabled`, **nothing is billing** — the earlier US$150–360 accrued-spend estimate is
superseded and was wrong. `az consumption usage list` returns nothing usable on this
subscription.

### Consequences for other open questions

- **Readiness #1 Azure half: Done.** The resources exist; they are deactivated, not
  deleted. Reuse is possible only after a billing fix (AZ-1).
- **Readiness #3 / AUD-0 / BE-1:** the exposed admin password is **not exploitable
  today** — nothing is listening. It becomes urgent the instant AZ-1 is resolved.
- **Deploy history (NL-1):** independent of path filters, a deploy to a disabled
  subscription cannot succeed. This is consistent with the owner's "never live" claim
  for the present state, though it says nothing about Mar–Apr 2026 when the
  subscription was presumably active.
- **DEPLOY-1:** the recommended target (ACA + Cloudflare Pages + Neon) uses none of
  these resources, so a write-off is viable — but ACA also needs a working Azure
  subscription, so AZ-1 gates that option too. Neon + Cloudflare Pages do not.
- **Deletion clock (UNVERIFIED — owner to confirm in the portal):** Azure deletes a
  disabled subscription's resources after a grace period; the exact window depends on
  the offer and is *not* confirmed here. Assume it is finite and short. The DB cannot
  be exported while the subscription is disabled, so any data that matters depends on
  resolving AZ-1 before that period lapses.

## Azure (superseded — first pass, could not be queried)

> Superseded by §Azure (verified) above, same day. Kept for the audit trail.

`az` CLI is not installed on this machine and there is no `~/.azure` directory, so no
login session exists here. None of the banned/secret-revealing commands were needed or
attempted. The following therefore remains **unknown**:

- Whether `codetutor-rg` exists, and what resources it holds (`codetutor-fyp-hei`,
  `codetutor-frontend-hei`, App Service plan, anything else).
- Whether the Postgres flexible server exists, its SKU/state, and its firewall rules.
- ACR / Container Apps presence (expected: none — zip deploy was used).
- Actual spend.

**Cost estimate (inference only, not a query):** if the April 2026 setup is still
running untouched, the plausible monthly burn is an App Service plan (B1 ≈ US$13/mo;
two apps may share one plan or use two) plus a Postgres Flexible Server
(B1ms ≈ US$13–16/mo + storage) — roughly **US$25–60/mo**, i.e. US$150–360 since the
last deploy attempt. If the subscription was a student/credit subscription that
expired, the burn may be $0 and the resources deallocated or deleted. **Unverified
either way.**

### Owner: read-only commands to finish the inventory — DONE 2026-10-23

> These were run; results in §Azure (verified). Kept as the reproduction recipe.

Run where `az` is installed and logged in (Azure Cloud Shell at portal.azure.com works
and needs no local install). All read-only:

```bash
az account show -o table
az group list -o table
az resource list -g codetutor-rg -o table
az webapp list -g codetutor-rg -o table
az appservice plan list -g codetutor-rg -o table          # SKU → cost driver
az postgres flexible-server list -o table
az postgres flexible-server firewall-rule list -g codetutor-rg -n <server-name> -o table  # rule names + IP ranges only
az consumption usage list --top 5 -o table                 # may 403 on student subs
```

Do **not** run anything that prints connection strings, app settings, publish
profiles, or Key Vault secrets.

## BE-1 impact (readiness #3)

The premise in earlier docs ("before the repo is ever shared/public") is already
false: **the repo is public today**, and the old Postgres admin password is in public
git history (see `docs/reports/codebase-analysis-2026-10-22.md`, BE-1). Anyone can
read it. Risk is live only if the Postgres server still exists and allows public
network access — which is exactly the unverified part above. Owner should treat this
as: **inventory first, and if the server exists, rotate the admin password (or delete
the server) the same day.** Rotation command (state-changing — owner runs it, not
agents):

```bash
az postgres flexible-server update -g codetutor-rg -n <server-name> --admin-password <new-strong-password>
```

History purge (BFG/filter-repo + force push) remains a separate owner decision; with
the repo already public, rotation is the part that matters — purging without rotation
fixes nothing, and the value must be assumed compromised regardless.

## Proposed cleanup (NOT run — owner decision, all state-changing)

Only if the inventory confirms the resources exist and the owner chooses
**recreate-later over reuse** (the DEPLOY-1 recommendation — Container Apps + Neon —
uses none of the old resources):

```bash
# Cheapest full stop (destroys data — export/backup the DB first if anything matters):
az group delete -n codetutor-rg          # removes web apps, plan, and (if inside) the server

# Softer options if unsure:
az postgres flexible-server stop -g codetutor-rg -n <server-name>   # stops compute billing ~7 days, auto-restarts after
az appservice plan update -g codetutor-rg -n <plan-name> --sku F1   # drop plan to Free tier
```

GitHub side, once Azure resources are gone (or if zip-deploy is abandoned per
DEPLOY-1): delete the now-dangling secrets `AZURE_CREDENTIALS`,
`AZURE_WEBAPP_PUBLISH_PROFILE`, `AZURE_FRONTEND_PUBLISH_PROFILE` and disable the two
workflows — this permanently de-fangs the latent deploy pipelines. (Owner action:
`gh secret delete <name>`, `gh workflow disable <id>`.)

> **Second-pass note:** none of the cleanup commands above can run while the
> subscription is `Disabled` (`ReadOnlyDisabledSubscription`), and none is needed for
> cost — nothing is billing. They become relevant only if AZ-1 is resolved and the
> owner then chooses recreate-over-reuse. The GitHub-side de-fanging (deleting the
> dangling secrets, disabling the workflows) is unaffected and can be done any time.

## What changed in the docs

First pass:

- Readiness #1: GitHub half **verified** (secrets exist, workflows active + enabled,
  repo public); Azure half still **Needs owner** — `az` unavailable on the dev machine.
- Readiness #2: **Done (explained)** — path filters, not a CI fault.
- Readiness #3 (BE-1): note updated — repo is public **now**; rotation urgency raised.

Second pass (same day, after owner authorised `az`):

- Readiness #1: Azure half **verified → Done** — resources exist but the subscription
  is `Disabled`; reuse gated on a billing fix.
- Readiness #3 (BE-1): urgency **re-scoped** — exposed, but not exploitable while the
  server is deactivated; becomes same-day urgent on any restore.
- Backlog: **AZ-1** (subscription disabled), **AZ-2** (all-IPv4 firewall rule),
  **BE-DB-TO** (missing `connect_timeout`) added; AUD-0 annotated.
- Plan: `docs/plans/active/2026-10-23_azure-subscription-disabled_awaiting-owner.md`.
