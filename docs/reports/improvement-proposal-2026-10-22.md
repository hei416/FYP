# Improvement proposal — 2026-10-22 (decision document)

Owner purpose: **maintain + portfolio**, no deadline. Basis: [codebase-analysis-2026-10-22.md](codebase-analysis-2026-10-22.md) and the verified audit (IDs below refer to `docs/plans/active/codebase-audit.md`). Constraint that shapes everything: **any pushed `*.py` change deploys the live backend**, and the CI health check currently validates the previous build (FE-7) — so fixes are batched into few, owner-reviewed pushes, each manually verified after deploy.

> **Superseded in part, 2026-10-22 (later the same day):** the owner states the app has **never been live in production** ([deployment-evidence-2026-10-22.md](deployment-evidence-2026-10-22.md)). The "live backend" constraint above and the per-option "risk to live deploys" ratings are re-based in the **Reassessment** section at the end of this document; the original text is kept unchanged above it. The no-push rule stands (latent workflows may still be armed).

## The three options

### Option A — minimal: stabilise and document
- **Scope:** Phase 0 owner actions (rotate BE-1, terminal decision AUD-1, confirm `frontend/.env.*`), the one-commit CI repair (AUD-2: FE-2/3/7/8/9/11, GAP-9), disable the `/ws/terminal` proxy, README accuracy fixes (BE-22/23, node-pty claim), keep the docs tree current. No other code changes.
- **Effort:** 12–20 h (plus ~1 h owner time in Azure).
- **Risk to live deploys:** very low — one CI-only push and one tiny backend push (proxy disable), each tagged and manually verified.
- **Benefit:** kills the two fires and the untrustworthy pipeline; portfolio value limited — the audit stays a list of known-but-unfixed holes; maintenance debt untouched.

### Option B — balanced: security, reliability, tests, portfolio polish  ← recommended
- **Scope:** everything in A, then three batched pushes: (1) security batch — SEC-7..14, SEC-16, SEC-10..13, SEC-21, terminal hardening SEC-2/3/5/6, BE-1 code cleanup; (2) reliability/perf batch — BE-2/3 migrations, BE-8..13 perf, BE-16 config, GAP-4 indexes, SEC-15/17/18/20; (3) frontend batch — FE-4 DOMPurify, SEC-24, FE-16. Plus deploy-inert work: `dev-requirements.txt` + `pytest.ini` + first backend unit tests (auth/roles/register — FE-15), RAG eval golden set (GAP-3, results in docs/), README/docs polish, a11y quick wins (FE-19) folded into the frontend batch.
- **Effort:** 55–75 h over several sittings.
- **Risk to live deploys:** moderate but controlled — 4 deploying pushes total, each pre-tagged, reviewed, and manually health-checked (CI checks only become trustworthy after the A-stage CI repair, which lands first).
- **Benefit:** closes every critical/high; backend gets its first real tests; the portfolio story becomes "audited, fixed, verified, measured" — the strongest outcome per hour for maintain + portfolio.

### Option C — ambitious: restructure, CI tests, staging, RAG evaluation harness
- **Scope:** everything in B, plus: move the backend into `backend/` (move map below), pytest gate in CI before deploy, an Azure staging slot (or second cheap App Service) with swap, Alembic as the single migration path (BE-21), a committed RAG evaluation harness with retrieval metrics run in CI, `TeacherClassroomDetail.js` (3102 lines) refactor, CRA→Vite (FE-14).
- **Effort:** 130–170 h; the restructure alone is ~15–20 h of careful, all-at-once work.
- **Risk to live deploys:** high at two moments — the restructure push (every path the deploy depends on changes at once) and the migration-system switch. Needs the staging slot *first*, which may add Azure cost.
- **Benefit:** a genuinely production-shaped repo; best portfolio ceiling, but most of the extra credit over B comes from the test gate + eval harness, which B already captures in lighter form.

## Recommendation

**Option B**, with two C elements pulled in only if appetite remains: the CI pytest gate (cheap once tests exist) and the staging slot (decide after seeing Azure cost). Reasons: the purpose is maintain + portfolio with no deadline — B closes all real risk, creates the test safety net, and tells the best story; C's restructure moves every deploy-sensitive path for mostly cosmetic gain and is the only part of C with real rollback pain. A is only right if available time is under ~20 h.

### Phased roadmap (B)

| Phase | What | Depends on | Deploys | Rollback |
|---|---|---|---|---|
| 0 | Owner: rotate BE-1 password; decide AUD-1 terminal stance; confirm `frontend/.env.*`; approve CI commit | — | none | n/a |
| 1 | CI repair commit (AUD-2 + GAP-9) incl. FE-3 frontend-zip fix; add `terminal-service/**` filter; drop `--async`/fix health polls; narrow `'**.py'` | 0 | ci only | `git revert`, push |
| 2 | Security batch (AUD-3 + BE-1 code side + terminal hardening) — one reviewed backend push, pre-push tag | 0 (rotation!), 1 (trustworthy health check) | backend | revert + redeploy previous tag; verify `/health` manually |
| 3 | Reliability/perf batch (AUD-5/6, BE-16, GAP-4, remaining med SEC) | 2 | backend | same pattern |
| 4 | Tests + tooling: `dev-requirements.txt`, `pytest.ini`, auth/role unit tests; optional CI pytest gate | 1 (else every test edit deploys — FE-8) | backend (ships only) | low risk — additive |
| 5 | Frontend batch: FE-4 DOMPurify, SEC-24, FE-16, FE-19 quick a11y, GAP-11 shared api.js started | 1 (FE-3 fixed) | frontend | revert + redeploy |
| 6 | Portfolio polish: README accuracy, RAG eval golden set + first results in docs/, this cycle's reports linked | any time | none | n/a |

## Target structure (propose-only — NOT part of B; do not execute without a separate owner decision)

Move map (old → new), designed so `git mv` preserves history:

```
main.py, database.py, db_models.py, models.py,          → backend/<same name>
rag_system.py, create_admin.py, rebuild_vectorstore.py,
schema_migration.py (post-rotation), local_llm_fallback.py (or delete, BE-24)
routers/, services/, core/, scripts/, evaluation/        → backend/<same dir>/
tests/                                                   → backend/tests/
practical_tests/, java_docs/, vectorstore/,              → backend/<same dir>/
quiz_questions.csv
requirements.txt                                         → backend/requirements.txt
startup.sh                                               → stays at repo root (Azure startup command keeps working)
terminal-service/, frontend/, docs/, docker-compose.yml  → stay
verify_enhanced_support.py, verify_schema.py             → delete first (BE-24) rather than move
public/                                                  → delete in the same change (owner call — stale frontend.yml filter dies with it)
```

Exact changes it would require (all in **one** push, after a staging rehearsal):

1. **`core/config.py`:** `PROJECT_ROOT` is `dirname(dirname(abspath(__file__)))` (core/config.py:21-22) — with `core/` under `backend/` it resolves to `backend/`, which stays correct **only because** `vectorstore/`, `java_docs/`, `practical_tests/` move too. The broken `PDF_DIR` default pointing into `frontend/` (BE-16) must be fixed in the same commit or `/pdfs` keeps 500ing.
2. **`startup.sh`:** the `find /tmp -name main.py` fallback (startup.sh:10-11) still finds `backend/main.py`, but make it explicit: `APP_DIR="${APP_DIR:-/home/site/wwwroot}/backend"`; terminal-service launch (startup.sh:88-91) becomes `$APP_DIR/../terminal-service`; gunicorn `--chdir "$APP_DIR"` unchanged in form.
3. **`.github/workflows/backend.yml`:** paths → `backend/**`, `startup.sh`, `terminal-service/**`, workflow file itself (removes `'**.py'`, FE-8, and stale `lessons_raw/**`, GAP-9); zip step includes `backend/ startup.sh terminal-service/`; `pip install -r backend/requirements.txt`.
4. **`.github/workflows/frontend.yml`:** drop stale root `src/**`, `public/**`, `package.json` filters (FE-9) in the same cleanup.
5. **`docker-compose.yml`:** working dirs and volume paths gain the `backend/` prefix; terminal-service block unchanged.
6. **Azure:** no portal change if `startup.sh` stays at root and the startup command already invokes it; verify Oryx doesn't try to auto-detect a root Python app (keep `requirements.txt` out of root — that's the move — and confirm `PYTHONPATH`/app-settings don't hardcode old paths). Rehearse on a staging slot first; rollback = revert commit + redeploy previous tag.
7. **Docs:** AGENTS.md path table, docs/OPS.md commands, docs/modules/* references.

## Quick wins

**Deploy-inert (safe to do any time, no push risk beyond the docs themselves):**
- README accuracy: node-pty claim, absent `migrate_to_postgres.py` (BE-23/KI-6), stale issue #4 wording (BE-22), link Known Issues → backlog.
- This cycle's two reports + audit GAP section (done, this branch).
- `dev-requirements.txt` + `pytest.ini` (match no CI filter; they only *ship* with the next backend deploy).
- RAG eval golden-question set + methodology as `docs/` content (the runner `.py` waits for Phase 1's CI fix).
- Backlog/decision hygiene, `.gitignore` entries, archive upkeep.

**Deploy-triggering (batch into the phased pushes above):**
- Every `.py` edit, `requirements.txt` (incl. GAP-10 dedupe, FE-13 bump), `startup.sh`, anything under `routers/ services/ core/ practical_tests/ vectorstore/` → backend deploy.
- Anything under `frontend/` (FE-4, SEC-24, FE-16, FE-18/19, GAP-11/12) → frontend deploy.
- `.github/workflows/**` → the pipelines themselves (owner-reviewed, Phase 1).
- `terminal-service/**` → **no trigger today (FE-2) but ships with the next backend deploy** — treat as deploying.

## Decisions needed from owner (recommended default first)

1. **Rotate the Postgres admin password now** (BE-1) — *default: yes, today; blocks everything else.* **Answered 2026-10-22: deferred by owner** (no-leak confirmed; backlog AUD-0, Parked — value remains in git history). Code side done separately on `fix/be1-credential-env`.
2. **Terminal service stance** (AUD-1): disable `/ws/terminal` + keep :3001 private until hardened, vs harden in place in Phase 2 — *default: disable in the Phase 2 push, harden in the same batch (SEC-2/3/5/6); full sandboxing (SEC-4) deferred.*
3. **Pick option A / B / C** — *default: B.*
4. **Approve the Phase 1 CI repair commit** (AUD-2 — only agent-proposed, owner-reviewed CI change) — *default: yes; it gates everything.*
5. **FE-3 frontend pipeline fix shape**: restore a minimal static `server.js` vs switch App Service to static serving — *default: minimal static Express/`serve` entry restored in frontend/, same zip layout; least Azure-side change.*
6. **Confirm `frontend/.env.*` are URL-only** (SEC-22/FE-6), then untrack — *default: owner inspects; if URL-only, untrack + ignore without history purge.*
7. **Dead code deletes** (BE-24: `verify_schema.py`, `verify_enhanced_support.py`, `local_llm_fallback.py`) — *default: delete `verify_schema.py` in the Phase 2 batch (no longer carries the credential since 2026-10-22, but still dead code), park the rest.*
8. **`quiz_questions.csv` in git** (KI-9) — *default: keep and document; revisit only if it gains sensitive content.*
9. **Future restructure to `backend/`** (move map above) — *default: defer; recorded as propose-only.*
10. **Staging slot / CI pytest gate** (C elements) — *default: pytest gate yes once Phase 4 tests exist; staging slot only if restructure is ever approved.*

---

## Reassessment 2026-10-22 — under "never deployed" (owner statement)

Premise change: the owner states the app has never been live in production; CI history shows past deploy runs but none since 2026-04-22, and whether the App Services/secrets still exist is unverifiable ([deployment-evidence-2026-10-22.md](deployment-evidence-2026-10-22.md)). Code-level **severities are unchanged** — what changes is **urgency** (no exposed users, no production data believed at risk) and the **cost of risk** (a bad push breaks a latent pipeline, not a running service). The no-push rule stays regardless.

### Re-rated urgencies

| Finding | Old urgency (live) | New urgency (not deployed) |
|---|---|---|
| BE-1 committed DB credential (AUD-0) | critical — rotate today | **fix before first deploy** (rotate or confirm the Azure Postgres is gone; history purge still required before the repo is ever shared/public). No live data believed at risk today. |
| Terminal RCE SEC-1..6/FE-1 (AUD-1) | critical — publicly reachable | **fix before first deploy** — no exposure while nothing runs online. The `ENABLE_TERMINAL` gate (default off, on `fix/terminal-and-ci`) becomes a hard first-deploy gate, not an emergency hotfix. Hardening SEC-2/3/5/6 required before the flag is ever turned on. |
| CI repair (AUD-2, FE-2/3/7/8/9/11) | critical/high — untrustworthy pipeline guarding a live app | **fix before first deploy** (medium now) — plus a new open question: zero runs since 2026-04-22 despite matching pushes; resolve before trusting CI at all. |
| Auth/exposure batch (SEC-7..14, SEC-16, SEC-10..13, SEC-21, AUD-3) | high — live attack surface | **fix before first deploy** — these define whether a first deployment is safe at all. |
| XSS FE-4 (AUD-4) | high | **fix before first deploy**. |
| Migration safety BE-2/3 (AUD-5) | high-ish | **fix before first deploy** — the first deploy runs migrations on a fresh DB; silent-success (BE-3) would mask a broken bring-up. |
| Dependency FE-13 (`python-multipart` ReDoS-class) | med | **fix before first deploy** (cheap). |
| Perf AUD-6 (BE-7..13, GAP-4), pagination KI-3, error specificity KI-2 | high/med (user-visible) | **fix later** — no users to feel it; do when convenient or post-launch. |
| Observability GAP-6, RAG quality GAP-RAG, frontend duplication GAP-FE, dead code, remaining med/low (AUD-7) | med/low | **fix later**. |
| SEC-ENV confirm `frontend/.env.*` URL-only | high (possible leaked secret) | unchanged in kind — **needs owner** either way; gate on repo-sharing and first deploy. |

### Options A/B/C re-rated

- **Option A — stabilise and document.** Effort shrinks to ~8–15 h (no emergency rotation choreography, no live verification). Risk ≈ none. But with no live fires burning, A now delivers almost nothing beyond what docs already capture — right only if the project stays offline indefinitely.
- **Option B — balanced (adopted).** Effort ~50–70 h (slightly down: the batching-for-live-deploys overhead and per-push manual site verification disappear; work can proceed as normal small reviewed branches). Risk drops to low — nothing live to break; the residual risk is accidentally arming a latent deploy, covered by the no-push rule. Scope unchanged; **sequencing re-cut** into "before first deploy" (security batch, migrations, CI repair, FE-4, FE-13) vs "later" (perf, observability, polish).
- **Option C — ambitious.** The big re-rating: the `backend/` restructure was rated high-risk **because it changed every path a live deployment depends on**. With nothing deployed, worst case is a broken first-deploy attempt debugged offline. Restructure estimate drops ~15–20 h → **~10–15 h** (no mandatory staging rehearsal; validation = local run + CI dry paths + the readiness checklist); the staging slot can be deferred until a launch is actually planned; total C ≈ **90–130 h** (was 130–170). Risk: low-moderate (was high). Moreover the restructure is **cheapest now, before first deploy** — it only ever gets more expensive once something is live.

### Recommendation (updated)

**Option B stays the baseline** (owner-adopted; closes every critical/high and builds the test net), re-sequenced into pre-deploy vs later as above. **One change proposed: re-open proposal decision #9** (the `backend/` restructure), because its recorded rejection reason — "moving code risks the live deployment" — no longer holds under the owner's statement; if the owner still wants the production-shaped repo for portfolio value, doing it **before** the first deploy is the cheap, safe window. The CI pytest gate stays pulled in (decision #10, default yes once Phase-4 tests exist); the staging slot stays deferred until a real launch decision. If the owner confirms no launch is ever intended, downgrade to A plus the pre-public-repo items (BE-1 history purge, SEC-ENV).

First-deploy gate checklist: [../plans/active/first-deploy-readiness.md](../plans/active/first-deploy-readiness.md).
