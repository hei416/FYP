# Codebase audit — 2026-10-22 (read-only)

> **Verification 2026-10-22 (second read-only pass):** every critical and high finding was spot-checked against the code — all 34 IDs (31 distinct; FE-1, BE-4 and BE-12 are cross-references of SEC-2, SEC-9 and SEC-13) are **Confirmed** (file:line correct, evidence real); none Stale, none Disputed. One nuance on BE-6: `rag_system.py:378-385`'s own comment guarantees retrieval+LLM run in *one* thread per request, but nothing serialises *concurrent* requests hitting the shared chain via `asyncio.to_thread` (`routers/rag.py:87,1006`) — finding stands. New gaps found by this pass are appended as GAP-1..13 at the end of this file; human-readable summary in `docs/reports/codebase-analysis-2026-10-22.md`.

Static analysis only (grep + targeted reads; no app runs, no Azure, no `.env*` files read). Three parallel read-only passes: security (SEC), backend quality/perf (BE), frontend/CI/deps/tests (FE). **No fixes applied** — owner approval required before any change; almost every backend fix triggers a live deploy when pushed (any `*.py` matches the CI filter). Severity: critical / high / med / low. Effort: S/M/L. Deploy column = what a push of the fix would deploy.

> Secrets policy: locations only, values never reproduced here.

## Act-first items (owner action needed before any code fix)

1. **BE-1 (critical):** a live Azure Postgres admin password is hardcoded in tracked files `schema_migration.py:16-19` and `verify_schema.py:7`. **Rotate the password in Azure first**, then remove from code and purge git history. Until rotated, treat the repo as leaking a production DB credential.
2. **SEC-1..6 (critical):** the terminal service is unauthenticated RCE: no auth/origin check on the WebSocket (`terminal-service/server.js:39-55`), attacker-controlled filename → arbitrary file write (`server.js:64-66`) and `javac` argument injection (`server.js:75`), unsandboxed `java` execution with inherited env and no timeout/memory cap (`server.js:91-95`); exposed to the internet via the backend proxy `routers/terminal.py:24-29` (accepts with no token check) and to the LAN via `docker-compose.yml:35-36` (`3001:3001` on all interfaces). **Consider disabling the `/ws/terminal` proxy route until fixed.** Note: contrary to the README, there is no node-pty — `server.js` uses plain `child_process`.

## SEC — security findings

| ID | Sev | Where | Evidence (short) | Fix | Eff | Deploy |
|---|---|---|---|---|---|---|
| SEC-1 | crit | terminal-service/server.js:39-55 | ws server, no auth/origin check | JWT on connect + verify Origin, bind 127.0.0.1 | M | backend |
| SEC-2 | crit | terminal-service/server.js:64-66 | unsanitised `filename` → path traversal file write | `path.basename` + `^[A-Za-z0-9_]+\.java$` allowlist | S | backend |
| SEC-3 | crit | terminal-service/server.js:75 | filename starting `-` becomes javac flag | same allowlist + `--` | S | backend |
| SEC-4 | crit | terminal-service/server.js:91-95 | unsandboxed `java` run, full env, no timeout/limits | container/nsjail + kill-timer + `-Xmx` + scrubbed env | L | backend |
| SEC-5 | crit | routers/terminal.py:24-29 | `/ws/terminal` accepts with no token, bridges to :3001 | verify token before `ws.accept()` | S | backend |
| SEC-6 | high | docker-compose.yml:35-36 | `3001:3001` published on all interfaces | `127.0.0.1:3001:3001` | S | backend |
| SEC-7 | high | routers/auth.py:165-169 | anyone can self-register as `teacher` (unlocks classroom/grading routes) | force `student` on register; admin promotes | S | backend |
| SEC-8 | high | main.py:471-477 | CORS `allow_origins=["*"]` + credentials | explicit origin allowlist | S | backend |
| SEC-9 | high | main.py:494-497 | full traceback in 500 responses, not DEBUG-gated | log server-side, generic message | S | backend |
| SEC-10 | high | routers/classroom.py:1460-1529 | file view/download skip membership check | reuse list_files gate (:1419-1425) | S | backend |
| SEC-11 | high | routers/rag.py:1575-1655 | conversation history read/delete with no auth, user_id from body | `Depends(get_current_user)` | M | backend |
| SEC-12 | high | routers/code_execution.py:301-319 | `/explain-error` unauthenticated LLM spend | auth + rate limit | S | backend |
| SEC-13 | high | routers/lessons.py:328-339 | unauthenticated SSRF proxy (`requests.get(url)` verbatim) | domain allowlist, block private IPs | M | backend |
| SEC-14 | med | routers/auth.py:161,203 | no rate limit on login/register | `@limiter.limit("5/minute")` | S | backend |
| SEC-15 | med | core/rate_limiter.py:12 + startup.sh:95-99 | IP key behind proxy → one global bucket | trust X-Forwarded-For or key by user | S | backend |
| SEC-16 | med | routers/auth.py:27,180 | no password policy at all ("" accepted); no validator exists anywhere | Pydantic validator (README issue #1's "unwired validator" doesn't exist) | S | backend |
| SEC-17 | med | routers/auth.py:19,233 | 7-day JWTs, indefinite refresh, no revocation | ~60 min access + refresh token | M | backend |
| SEC-18 | med | routers/classroom.py:36-37 | join codes from `random`, not CSPRNG | `secrets.choice` | S | backend |
| SEC-19 | med | routers/classroom.py:1464-1472 | JWT in `?token=` URL (logs/Referer leak) | short-lived single-use file token | M | backend |
| SEC-20 | med | routers/classroom.py:1261-1264 | legacy upload: no MIME/size check; `MAX_UPLOAD_SIZE_BYTES` never enforced | apply checks or delete legacy route | M | backend |
| SEC-21 | med | routers/practical_tests.py:451,635; routers/rag.py:455-1288 | LLM generate/grade endpoints unauthenticated, unlimited | auth + per-user limits | M | backend |
| SEC-22 | low | frontend/.env.development, .env.production (tracked) | contents unverified (not read, per rules); CRA inlines REACT_APP_* into public bundle anyway | owner: confirm URL-only; untrack + ignore + rotate if not | S | frontend |
| SEC-23 | low | frontend/src/AuthContext.js:60,89 | 7-day JWT in localStorage (XSS-readable) | httpOnly cookie or shorter expiry | M | frontend |
| SEC-24 | low | frontend/src/components/InteractiveTerminal.jsx:40 | hardcoded `ws://localhost:3001`, bypasses proxy, mixed-content | use `REACT_APP_*` + wss proxy path | S | frontend |
| SEC-25 | low | main.py:548-562 | debug endpoints correctly DEBUG-gated; default false | no change needed | — | none |
| SEC-26 | low | routers/pdfs.py:9-23 | unauthenticated but traversal-safe PDF serving | add auth dependency | S | backend |
| SEC-27 | low | routers/classroom.py:2226-2229 | operator-precedence bug makes membership subquery dead code | parenthesize / simplify | S | backend |

Positive: no hardcoded keys in `.py`/`.js`/`.yml` apart from BE-1; config is env-only; `SECRET_KEY` fallback is an inert sentinel that refuses to sign; CI uses `${{ secrets.* }}` correctly.

## BE — backend quality / performance findings

| ID | Sev | Where | Evidence (short) | Fix | Eff | Deploy |
|---|---|---|---|---|---|---|
| BE-1 | crit | schema_migration.py:16-19; verify_schema.py:7 | live Azure Postgres admin DSN hardcoded in tracked files | rotate in Azure, use env var, purge history | S | backend |
| BE-2 | crit | main.py:100-305 vs startup.sh:51 | migrations are Postgres-only SQL; startup defaults to SQLite → every statement fails | gate on `engine.dialect.name`; raise on failure | M | backend |
| BE-3 | crit | main.py:306-307,384-387 | migration errors swallowed; always logs "✅ All migrations complete" | fail loudly | S | backend |
| BE-4 | high | main.py:494-497 | (= SEC-9) tracebacks to clients | generic message unless DEBUG | S | backend |
| BE-5 | high | routers/rag.py:136-137; main.py:358-359; services/classroom_rag.py:56 | module-level retriever/chain singletons — violates README:279's own warning | move to `app.state` + dependency | M | backend |
| BE-6 | high | rag_system.py:384; routers/rag.py:87,1006 | shared non-thread-safe FAISS chain hit from multiple pool threads | lock around retriever access | M | backend |
| BE-7 | high | routers/*.py | pagination on exactly 2 endpoints; 48 unbounded `.all()` in classroom.py alone (README #3 confirmed) | `skip`/`limit` + server max | M | backend |
| BE-8 | high | services/classroom_rag.py:368-372 | one query per chunk when building classroom index | batch `in_()` preload | S | backend |
| BE-9 | high | routers/classroom.py:922-946 | nested N+1 (classrooms × students × 2 queries) | grouped aggregate queries | M | backend |
| BE-10 | high | routers/classroom.py:629-643,1100-1105 | same N+1 in analytics | batch + group | M | backend |
| BE-11 | high | routers/rag.py:79 | blocking embed+FAISS call on the event loop | `asyncio.to_thread` | S | backend |
| BE-12 | high | routers/lessons.py:337 | sync `requests.get` in async def (also SEC-13) | httpx.AsyncClient + allowlist | S | backend |
| BE-13 | high | routers/practical_tests.py:514-535 | sleepless 30s Paiza poll loop, no timeout | `sleep(0.5)` + `timeout=` | S | backend |
| BE-14 | med | 28 sites (rag.py ×19, lessons.py ×6, …) | catch-all → 500 with internal text (README #2 confirmed; zero bare `except:`) | specific types, 4xx/502 mapping | M | backend |
| BE-15 | med | routers/lessons.py:56-58 | HTTPException swallowed and double-wrapped | re-raise before generic handler | S | backend |
| BE-16 | med | core/config.py:27-28 | `LESSON_DIR` dead; `PDF_DIR` live and broken (pdfs.py 500s unless env set) | delete / repoint + graceful 404 | S | backend |
| BE-17 | med | services/conversation_manager.py:37-43 | DB session lifetime tied to `__del__`, held across LLM calls | inject session via `get_db` | M | backend |
| BE-18 | med | services/classroom_rag.py:60-63 | unlocked lazy singleton (nli_monitor.py:317-331 has the correct pattern) | copy the locked pattern | S | backend |
| BE-19 | med | services/classroom_rag.py:154,382 | unbounded per-classroom FAISS index cache | LRU bound | S | backend |
| BE-20 | med | main.py:471-477 | (= SEC-8) CORS misconfig | allowlist | S | backend |
| BE-21 | med | schema_migration.py vs main.py:93-307 | two divergent migration implementations, neither versioned | Alembic, or single documented path | L | backend |
| BE-22 | low | routers/rag.py:973-1061 | README #4 premise stale: try/except + fallback exist; real gap = retrieval-only degradation on LLM failure | handle LLM errors in `chain_with_fallback`; fix README wording | M | backend |
| BE-23 | low | README.md:348 | `migrate_to_postgres.py` absent (README #6 confirmed; also in .gitignore) | fix reference or restore script | S | none |
| BE-24 | low | verify_enhanced_support.py, verify_schema.py, local_llm_fallback.py | dead code, zero imports | delete / archive (owner approval; deletes) | S | backend |
| BE-25 | low | main.py:413-427,105-304 | stdout route-dump + emoji prints bypass logging | `logger.debug` / DEBUG-gate | S | backend |

Positive: startup is well-architected (migrations/NLI/FAISS offloaded to threads with timeout; nothing heavy at import); all other `SessionLocal()` uses close properly.

## FE — frontend / CI / dependencies / tests findings

| ID | Sev | Where | Evidence (short) | Fix | Eff | Deploy |
|---|---|---|---|---|---|---|
| FE-1 | crit | terminal-service/server.js:57-66 | (= SEC-2) raw `filename` → `path.join`; `startup.sh:88-90` runs this service **in production** | `path.basename` + origin check | S | none (see FE-2) |
| FE-2 | crit | .github/workflows/backend.yml:6-16 | no `terminal-service/**` path filter, but the zip ships the directory — a server.js fix deploys **nothing** until an unrelated `.py` push | add `terminal-service/**` to filters | S | ci |
| FE-3 | crit | .github/workflows/frontend.yml:70 | deploy zips `server.js` which was deleted in commit bec2835 — package has no Node entry point | restore server.js or switch to static serving | M | frontend |
| FE-4 | high | frontend/src/CodingChallengePlayer.js:14-28,464 | LLM/backend content interpolated raw into `dangerouslySetInnerHTML` (also TopicDetailPage.js:221, EnhancedTopicDetailPage.js:198) | escape or DOMPurify | M | frontend |
| FE-5 | high | frontend/src/progressService.js:11 + AuthContext.js | JWT in localStorage (176 refs) — chains with FE-4 into one token-exfiltration path | httpOnly SameSite cookie | L | frontend |
| FE-6 | high | frontend/.env.production, .env.development | tracked in git; `.gitignore` misses them; contents not inspected per rules | ignore + purge history; owner confirms contents | M | frontend |
| FE-7 | high | .github/workflows/backend.yml:92-113 | `az webapp deploy --async true` + immediate `/health` poll → green verdict from the **previous** build | drop `--async` or poll a build id | S | ci |
| FE-8 | high | .github/workflows/backend.yml:7 | `'**.py'` matches tests/ and scripts/ too — editing a test deploys production | explicit app paths, exclude tests/scripts | S | ci |
| FE-9 | med | .github/workflows/frontend.yml:8-10 | stale filters; root `public/` exists (CRA leftover) and would trigger a deploy if touched | remove stale filters + orphan dir (owner-gated) | S | ci |
| FE-10 | med | frontend.yml:46 vs frontend/src/Compiler.js:53,438 | `REACT_APP_TERMINAL_WS` never set in CI build → terminal feature silently absent in prod (unless `.env.production` defines it — unverified) | set in build env | S | ci |
| FE-11 | med | .github/workflows/frontend.yml:74-94 | fixed sleeps + `--async` + restart race; no health check at all | sync deploy + poll before restart | S | ci |
| FE-12 | med | .github/workflows/frontend.yml:47 | `CI: false` disables warnings-as-errors | remove, fix warnings | M | ci |
| FE-13 | med | requirements.txt:46 | `python-multipart==0.0.6` — predates ReDoS-class fixes (0.0.7/0.0.9) | bump | S | backend |
| FE-14 | med | frontend/package.json:21 | `react-scripts` 5.0.1 unmaintained (frozen webpack/nth-check/svgo advisories, build-time only) | migrate to Vite or document | L | frontend |
| FE-15 | med | tests/ + requirements.txt | pytest/playwright/locust imported but in no manifest; zero pytest config/conftest | `dev-requirements.txt` + `pytest.ini` | S | backend* |
| FE-16 | med | frontend/src/App.test.js:4-7 | default CRA stub asserts "learn react" — cannot pass | delete or rewrite | S | frontend |
| FE-17 | low | requirements.txt | `transformers==4.40.2`/`torch==2.2.2` (unsafe-deserialization class for untrusted checkpoints), `bcrypt==4.0.1` behind | bump bcrypt; schedule ML bumps | M | backend |
| FE-18 | low | frontend/src/AI.js:594 et al. | 145 `console.*` calls ship to prod (token lengths only, no values) | strip at build | S | frontend |
| FE-19 | low | frontend/src/ | 56 form controls vs 6 `htmlFor` + 3 `aria-label`; 2 real clickable non-buttons (AI.js:664, ProgressDisplay.js:270); zero `<img>` (no alt debt) | label controls, convert to `<button>` | M | frontend |
| FE-20 | low | startup.sh:90 + package.json caret ranges | prod terminal-service does unlocked `npm install` at boot (needs egress, unreproducible) | `npm ci` / bundle node_modules | S | backend |

\* FE-15: only if deps are added to `requirements.txt`; a separate `dev-requirements.txt` is deploy-inert… except backend.yml ships the whole repo zip, so still verify.

**Largest frontend/src files:** TeacherClassroomDetail.js 3102 lines (the real refactor target), TeacherDashboard.js 1721, BasicJavaPage.js 1311 (static content, benign), StudentClassroomDetail.js 1244, Quiz.js 966.

**Test inventory:** 3 Python test files (441 lines) — Playwright E2E (auth, AI tutor, quiz, one code-exec happy path), browser-compat smoke, locust profile — all need a running stack; hardcoded dev credentials. Frontend: broken CRA stub + one real localStorage test. **Coverage gap = the entire backend:** zero unit tests for any router/service/core module, nothing for JWT/roles, RAG, or the code-execution path.

## Skipped in this audit (and why)

Cron/scheduling rules and outbound-sending safeguards (nothing runs unattended or sends anything); per-skill SKILL.md files (module docs in `docs/modules/` serve that role); dynamic testing, dependency-scanner runs (`npm audit`/`pip-audit`), live-URL checks — out of scope for a static, read-only pass.

## GAP — findings added by the 2026-10-22 verification pass

Same conventions as above (severity / effort / deploy-on-push). All evidence re-checked at commit add8edc.

| ID | Sev | Area | Where | Evidence (short) | Fix | Eff | Deploy |
|---|---|---|---|---|---|---|---|
| GAP-1 | med | architecture | routers/classroom.py (3121 lines), routers/rag.py (2069) | business logic lives in routers; `services/` thin (classroom_rag 516, conversation_manager 509) — the documented router→service pattern isn't held | extract services incrementally when touching each area | L | backend |
| GAP-2 | med | RAG | rag_system.py:146-154 vs services/classroom_rag.py:213-218 | two divergent chunkers: RecursiveCharacterTextSplitter (char-based) for global RAG vs naive word-split 500/50 for classroom RAG → inconsistent retrieval quality | one shared chunker module | M | backend |
| GAP-3 | med | RAG | evaluation/ (only nli_results.csv/.json); no `*.py` references them | RAG/NLI evaluation is a one-off artifact — no committed script regenerates it; no golden Q&A set, no retrieval metrics. Runtime NLI guard itself is good (services/nli_monitor.py, admin stats routers/admin.py:198) | commit a small eval harness (deploy-inert if under docs/ or tests/… but any `.py` matches CI — see FE-8) | M | backend* |
| GAP-4 | med | data model | db_models.py:49 (SavedWork.user_id), :149 (ClassroomChunk.file_id) | hot FK columns without `index=True`; SavedWork.user_id is the filter in every analytics N+1 loop (classroom.py:629-643, 922-946, 1098-1107) — compounds BE-9/10 | add indexes (+ migration) | S | backend |
| GAP-5 | low | data model | db_models.py:139 | `ClassroomFile.file_data` LargeBinary in Postgres — every view/download pulls whole blob through app memory; no size cap enforced (ties SEC-20) | size cap now; blob storage later | M | backend |
| GAP-6 | med | observability | 193 `print(` in main.py+routers/+services/ vs 5 modules using `logging.getLogger`; gunicorn `--log-level info` (startup.sh:104) | no levels, no structure, no request IDs — prod debugging is grep-on-stdout; extends BE-25 beyond main.py | module loggers + uvicorn access log; request-id middleware | M | backend |
| GAP-7 | low | API consistency | routers/rag.py:56,970,1066,1541,1575,1707 | one router mixes `/classroom/{id}/ask`, `/ragAI`, `/api/review-code`, `/rag/health`, `/api/conversations/*`, `/ask-multi` — no prefix convention (main.py:524-526 registers most routers prefixless) | document now; align on `/api/<area>` when next touched | M | backend |
| GAP-8 | low | auth/roles | routers/auth.py:148 defines `require_role()`; 47 manual `role ==`/`!=` checks across routers/ | the clean dependency exists but is barely used; ad-hoc variants (rag.py:147) drift | adopt `require_role` when touching each router | M | backend |
| GAP-9 | low | CI | .github/workflows/backend.yml:14 | path filter `lessons_raw/**` — directory doesn't exist (cf. dead `LESSON_DIR`, BE-16); pairs with FE-9 | drop with the AUD-2 CI commit | S | ci |
| GAP-10 | low | deps | requirements.txt:30 and :91 | `langchain-text-splitters==0.3.7` pinned twice | dedupe with next requirements change | S | backend |
| GAP-11 | low | frontend | 18 files in frontend/src define their own `REACT_APP_API_BASE \|\| localhost:8000` fallback (e.g. progressService.js:9) | no shared API client; base-URL/token logic duplicated | one api.js module, migrate opportunistically | M | frontend |
| GAP-12 | low | frontend | TopicDetailPage.js (500) vs EnhancedTopicDetailPage.js (433); both routed (App.js:160-161); same raw-HTML sink (:221 / :198) | near-duplicate pages double the FE-4 XSS surface and maintenance | pick one, redirect the other | M | frontend |
| GAP-13 | med | Azure cost/perf | startup.sh:96-97 (`--workers 1`); requirements.txt:12,26-30,98-99 (faiss-cpu, langchain stack, transformers 4.40.2, torch 2.2.2); main.py:390-392 (NLI pre-warm) | single worker + blocking sync calls (BE-11/12) → one slow request stalls the whole API; torch+transformers slug inflates memory/cold-start on App Service | fix BE-11/12 first; consider 2 workers after memory check; CPU-only torch wheel or ONNX for NLI later | M | backend |

\* GAP-3: a new eval `.py` anywhere in the repo matches backend.yml's `'**.py'` filter (FE-8) — deploy-inert only after the CI filter fix, or keep results-only updates in docs/.
