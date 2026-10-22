# Backend restructure + pre-first-deploy fixes — 2026-10-22

Branch: `refactor/backend-and-prebuild-fixes` (worktree `/Users/pandawork/FYP-restructure`), base `docs/not-live-reassessment` (fdc384b), safety tag `backup/pre-backend-restructure`. Owner decisions: Option B baseline; **decision #9 re-opened and approved** — execute the `backend/` move now (move map: `docs/reports/improvement-proposal-2026-10-22.md` §Target structure). Never push; owner reviews and merges by hand.

A parallel session on `docs/deploy-options` owns `docs/reports/deploy-options-*`, `docs/plans/active/first-deploy-readiness.md` and `docs/backlog.md` — **not edited here**; see §Backlog delta below for the owner to merge. Deploy method undecided → the AUD-2 CI commit stays on hold and workflow edits here are **minimal/provisional** only.

## Status

- **State: CLOSED — Part 1 and Part 2 complete, all checks green (see Verification log).**
- Part 1 (restructure): done — commits R1–R6 below.
- Part 2 (pre-deploy fixes): done — AUD-3 batch, AUD-5, dependency bumps, AUD-4.
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

- AUD-9 (new): backend/ restructure — **Done** on `refactor/backend-and-prebuild-fixes` (this plan), pending owner review/merge.
- AUD-3 (security batch SEC-7..13, SEC-21): **Done** (same branch) — pending review; SEC-14/16/17..20 remain open (not in this batch).
- AUD-5 (BE-2/BE-3 migration safety): **Done** (same branch) — pending review.
- AUD-4 (FE-4 XSS): **Done** (same branch) — pending review.
- FE-13 python-multipart + GAP-10 dedupe + bcrypt bump: **Done** (same branch) — pending review.
- BE-24 partial: `verify_schema.py`, `verify_enhanced_support.py` deleted with the restructure; `local_llm_fallback.py` parked (moved, not deleted).
- New: first backend unit tests exist (`backend/tests/`), dev deps in `backend/requirements-dev.txt` — CI pytest gate (decision #10) can now be designed once deploy method lands.

## Verification log

(filled in as commits land)
