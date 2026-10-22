# Backend restructure + pre-first-deploy fixes — 2026-10-22

Branch: `refactor/backend-and-prebuild-fixes` (worktree `/Users/pandawork/FYP-restructure`), base `docs/not-live-reassessment` (fdc384b), safety tag `backup/pre-backend-restructure`. Owner decisions: Option B baseline; **decision #9 re-opened and approved** — execute the `backend/` move now (move map: `docs/reports/improvement-proposal-2026-10-22.md` §Target structure). Never push; owner reviews and merges by hand.

A parallel session on `docs/deploy-options` owns `docs/reports/deploy-options-*`, `docs/plans/active/first-deploy-readiness.md` and `docs/backlog.md` — **not edited here**; see §Backlog delta below for the owner to merge. Deploy method undecided → the AUD-2 CI commit stays on hold and workflow edits here are **minimal/provisional** only.

## Status

- **State: COMPLETE — Part 1 (restructure) and Part 2 (pre-deploy fixes) done, all checks green (see Verification log). Awaiting owner review/merge** (the plan moves to `done/` once the owner merges; nothing was pushed).
- Branch `refactor/backend-and-prebuild-fixes`, 18 commits on top of `docs/not-live-reassessment`; base tagged `backup/pre-backend-restructure`.
- Owner actions: review/merge by hand; see §Needs owner and §Backlog delta.

## Part 1 — move map (old → new)

| Old | New | Note |
|---|---|---|
| `main.py`, `database.py`, `db_models.py`, `models.py`, `rag_system.py`, `create_admin.py`, `rebuild_vectorstore.py`, `schema_migration.py`, `local_llm_fallback.py` | `backend/<same>` | `git mv`; `rebuild_vectorstore.py` is self-relative (`Path(__file__).parent`) so it stays correct |
| `routers/`, `services/`, `core/`, `scripts/`, `evaluation/` | `backend/<same>/` | `git mv` |
| `tests/` | `backend/tests/` | `git mv`; offline suite unchanged |
| `practical_tests/`, `java_docs/`, `vectorstore/`, `quiz_questions.csv` | `backend/<same>` | `git mv` only; vectorstore sha256 recorded before/after (must be identical — see Verification log). No rebuild/regeneration. |
| `requirements.txt` | `backend/requirements.txt` | also keeps Oryx from auto-detecting a root Python app |
| `verify_schema.py`, `verify_enhanced_support.py` | **deleted** | per move map ("delete first (BE-24) rather than move"); recoverable from `backup/pre-backend-restructure` |
| `startup.sh`, `terminal-service/`, `frontend/`, `docs/`, `docker-compose.yml`, `public/`, root `*.md` | stay | `public/` stays (owner decision; stale frontend.yml filter). `startup.sh` stays at root so the Azure startup command keeps working. |

**Why `PROJECT_ROOT` keeps working:** `core/config.py` derives `PROJECT_ROOT = dirname(dirname(abspath(core/config.py)))`; with `core/` under `backend/` it resolves to `backend/` — correct because `vectorstore/`, `java_docs/`, `practical_tests/` move too. This is why `vectorstore/` must move with the code (the alternative — leaving it at root — would need an env override baked into every environment).

## Part 1 — every path reference that changes

| Where | Change |
|---|---|
| `core/config.py` | no code change needed (PROJECT_ROOT self-adjusts); stale `PDF_DIR`/`LESSON_DIR` defaults (BE-16) unchanged — out of scope, already on backlog |
| `startup.sh` | explicit `backend/` app dir (`find` fallback kept); terminal-service launched from the dir *above* `$APP_DIR`; gunicorn `--chdir "$APP_DIR"` unchanged in form |
| `docker-compose.yml` | backend `working_dir: /app/backend`, `pip install -r requirements.txt` resolved under it; stale node-pty comments corrected |
| `.github/workflows/backend.yml` | **provisional, minimal**: path filters → `backend/**` + `startup.sh` + `terminal-service/**` + workflow file; `pip install -r backend/requirements.txt`. Zip layout unchanged (repo root zip still contains `backend/`, `startup.sh`, `terminal-service/`). Deploy method undecided — do not treat as final CI. |
| `.github/workflows/frontend.yml` | no change needed (frontend layout untouched; stale root filters are FE-9, on-hold CI work) |
| `.claude/settings.json` | `ask` patterns for `schema_migration.py` / `rebuild_vectorstore.py` / `scripts/*` gain the `backend/` prefix |
| `AGENTS.md`, `docs/OPS.md`, `docs/modules/*`, `README.md` | run commands (`cd backend && uvicorn main:app`), path table, test paths |
| Not changed | `scripts/fetch_missing_docs.py` hard-codes a stale dev machine path (`/Users/hei/...`) — broken before and after the move; noted, left as-is. `docs/modules/classroom-roles.md` claim that `.py` files reference `quiz_questions.csv` is stale (only a DB table shares the name) — corrected in the docs commit. |

## Part 1 — ordered commits with verification

Per-commit verification (all must pass, run from `backend/` once it exists): `python -c "import main"`, `python -c "from core import config"`, offline pytest (`python -m pytest tests/test_terminal_proxy.py -q`), TestClient route-list script (route set must be identical to baseline: 120 `app.routes` = the app's "118" inclusion-time count + 2 late registrations, incl. 4 built-in docs routes), vectorstore index paths resolve, `git log --follow` works on a moved file. Blocking secret scan of the staged diff before every commit.

1. **R1** docs: this plan file.
2. **R2** move: the entire Python app + data dirs in one `git mv` commit (code modules, routers/services/core/scripts/evaluation, practical_tests/java_docs/vectorstore/quiz_questions.csv) + delete the two verify scripts. *Atomic on purpose:* any split (e.g. code first, data second) leaves an intermediate commit where `import main` or vectorstore resolution fails, which would violate the per-commit verification requirement.
3. **R3** move: `tests/` → `backend/tests/`.
4. **R4** `requirements.txt` → `backend/`; `startup.sh` + `docker-compose.yml` path updates.
5. **R5** workflows: minimal provisional path-filter/install edits (backend.yml only).
6. **R6** docs: AGENTS.md, OPS.md, modules, README, `.claude/settings.json`, audit statuses.

## Part 2 — pre-first-deploy fixes (one finding per commit, in order)

1. AUD-3 security batch: SEC-7 (teacher self-registration), SEC-8 (CORS), SEC-9 (traceback leak), SEC-10 (file view/download auth), SEC-11 (conversation history auth), SEC-12 (/explain-error auth), SEC-13 (SSRF proxy), SEC-21 (LLM endpoints auth) — one commit per finding, offline test each where possible.
2. AUD-5: BE-2 (dialect-gate migrations) + BE-3 (fail loudly); `schema_migration.py` must not run destructive steps by accident.
3. FE-13 `python-multipart` bump + GAP-10 dedupe + other flagged bumps (bcrypt); verify imports offline; note unverifiables.
4. AUD-4 / FE-4: XSS sanitisation in `frontend/src` (DOMPurify), incl. GAP-12 duplicate sink. `npm run build` + frontend tests before and after. Root `public/` and the `.bak` file untouched.

First backend unit tests land in `backend/tests/` with each fix; dev deps in `backend/requirements-dev.txt`; documented in `docs/OPS.md`.

## Rollback

- Whole effort: `git checkout docs/not-live-reassessment` / delete the branch; base tagged as `backup/pre-backend-restructure`. Nothing pushed, nothing deployed.
- Single commit: `git revert <sha>` (moves revert cleanly; `git mv` commits are pure renames).
- Vectorstore integrity provable: sha256 lists before/after in the Verification log (identical ⇒ bytes unchanged).

## Needs owner

- `scripts/fetch_missing_docs.py` hard-codes a stale dev path — delete or parameterise? (Left as-is.)
- Workflow edits are provisional; final CI shape waits on the deploy-method decision (`docs/deploy-options` session).
- SEC-7 fix forces new registrations to `student`; existing teacher accounts keep working, and admins promote via the existing admin route. If open teacher sign-up is a product requirement, this needs a different design (e.g. invite codes).
- SEC-8 CORS allowlist defaults to localhost origins, env-overridable via `CORS_ORIGINS` — the real frontend origin must be set at deploy time.
- Dependency bumps beyond import-checks are unverifiable offline (no integration suite); flagged in §Verification log.

## Backlog delta (for the owner to merge into docs/backlog.md — not edited here; that file belongs to the deploy-options session)

- New item: backend/ restructure (decision #9) — **Done** on `refactor/backend-and-prebuild-fixes` (this plan), pending owner review/merge. Workflow path filters updated provisionally only.
- AUD-3 (security batch SEC-7/8/9/10/11/12/13/21): **Done** (same branch) — pending review. SEC-14/16 (login rate limit, password policy) were NOT in the approved batch scope and remain open; SEC-17..20 unchanged.
- AUD-5 (BE-2/BE-3 migration safety + `schema_migration.py --yes` gate): **Done** (same branch) — pending review.
- AUD-4 (FE-4 XSS, incl. GAP-12 duplicate sink): **Done** (same branch) — pending review.
- FE-13 python-multipart 0.0.20 + GAP-10 dedupe + bcrypt 4.2.1 (FE-17 partial; transformers/torch deferred): **Done** (same branch) — pending review.
- BE-24 partial: `verify_schema.py`, `verify_enhanced_support.py` deleted with the restructure; `local_llm_fallback.py` parked (moved, not deleted).
- New: first backend unit tests exist (`backend/tests/test_security_fixes.py`, 18 tests + the 3 terminal-gate tests), dev deps in `backend/requirements-dev.txt` — the CI pytest gate (decision #10) can now be designed once the deploy method lands.
- New env vars to document at deploy time: `CORS_ORIGINS` (required for the real frontend origin), `PROXY_ALLOWED_HOSTS` (optional extension of the SSRF allowlist), `MIGRATION_CONFIRM` (only for deliberate schema_migration runs).

## Verification log

Environment: fresh venv (`/opt/homebrew/bin/python3.11`, repo-root `.venv/`), `pip install -r backend/requirements.txt` + pytest. Baseline captured on fdc384b before any move: `import main` OK ("Total routes: 118" app log; 120 total `app.routes` incl. 4 built-in docs routes + 2 post-inclusion registrations), offline pytest 3 passed, vectorstore sha256 list recorded (10 files).

| Commit | Checks |
|---|---|
| R1 plan file | secret scan clean (docs only) |
| R2 move (229 renames R100 + 2 deletes) | import main OK; config OK; route set identical (120); vectorstore index paths resolve under `backend/`; **vectorstore sha256 before/after identical (10/10 files)**; offline pytest 3 passed; `git log --follow backend/main.py` crosses the move; secret scan clean |
| R3 tests move | same suite green (pytest now from `backend/tests/`); secret scan clean |
| R4 requirements/startup/compose | `bash -n startup.sh` OK; compose YAML parses; full suite green; secret scan clean |
| R5 workflow (provisional) | workflow YAML parses; full suite green; secret scan clean |
| R6 docs/settings | settings.json JSON parses; full suite green; secret scan clean |

Not verifiable offline: Azure startup (`startup.sh` on App Service), the latent workflows themselves (never run by agents), docker-compose runtime (Docker not used in this session).

### Part 2 verification log

Per-commit: offline pytest suite (`backend/tests/test_security_fixes.py` + `test_terminal_proxy.py`, grew to 21 tests), route set identical to baseline (120), secret scan clean. Frontend commits: `npm run build` green before and after; `npm test` fails identically on the untouched tree (module-resolution, pre-existing — FE-16), so it is not a regression gate.

| Commit | Finding | Tests added |
|---|---|---|
| SEC-7 | register student-only | default role, 403 teacher/admin |
| SEC-8 | CORS allowlist | default list, env override |
| SEC-9 | no tracebacks in 500s | generic 500 body |
| SEC-10 | file view/download gate | 401/403/200 incl. `?token=` path |
| SEC-11 | conversation auth | 401 + cross-user 403 on all five endpoints |
| SEC-12 | /explain-error auth + rate limit | 401; authenticated short-circuit |
| SEC-13 | SSRF allowlist | metadata/localhost/private-IP/foreign-host 403, file:// 400, allowed host passes |
| SEC-21 | LLM endpoints auth (10) | 401 on all ten; frontend token headers added (build green) |
| AUD-5 | BE-2 dialect gate, BE-3 fail-loudly, `--yes` gate | sqlite skip; raises on failed steps; script exits 2 without `--yes` |
| deps | python-multipart 0.0.20, bcrypt 4.2.1, GAP-10 dedupe | import + bcrypt round-trip; multipart upload behaviour not verifiable offline; transformers/torch deferred |
| AUD-4 | DOMPurify on 3 sinks | `npm run build` green (no offline DOM test harness exists) |

## Close-out

- 2026-10-23 — Owner merged the branch to `main` (reorg merge stack, `df44bad` … `0303156`); a same-day follow-up tidy moved the remaining backend root modules into `core/`/`services/`/`scripts/` (`docs/plans/done/2026-10-23_backend-root-tidy_done.md`). Filed to `done/` as `2026-10-22_backend-restructure_done.md`.
