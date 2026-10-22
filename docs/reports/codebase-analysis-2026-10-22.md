# CodeTutor codebase analysis — 2026-10-22

Audience: project owner. Sources: the verified read-only audit (`docs/plans/active/codebase-audit.md`, IDs SEC/BE/FE/GAP — every critical and high finding re-checked against the code on 2026-10-22, all Confirmed) plus this pass's gap analysis. No secrets are reproduced here. Companion decision document: [improvement-proposal-2026-10-22.md](improvement-proposal-2026-10-22.md).

## Executive summary

CodeTutor is a feature-rich Java learning platform — RAG tutoring with a runtime hallucination guard, classrooms with roles and analytics, quizzes, practical tests, a code playground with an in-browser terminal — running live on two Azure App Services that deploy automatically on every push to `main`. The feature set is genuinely impressive for a final-year project; the engineering underneath is uneven: strong ideas (NLI faithfulness monitoring, threaded startup, committed vectorstores for fast boot) sit next to serious security holes and zero backend unit tests.

**Current health: functional but fragile, with two fires.** The application works in production, but a live database admin credential sits in the git history and working tree, and the code-execution terminal is an unauthenticated remote-code-execution service reachable through the public backend. Below those two, there is a thick layer of high findings (auth gaps on a dozen endpoints, CORS `*` with credentials, tracebacks sent to clients, N+1 analytics, blocking calls on a single worker) and a CI pipeline that can't be fully trusted (health checks validate the previous build; the frontend pipeline zips a file that no longer exists).

### Top 5 risks

1. **Leaked production DB admin credential** (BE-1, critical) — hardcoded in `schema_migration.py:16-19` and `verify_schema.py:7`, in git history. Anyone with repo access owns the database. *Owner action: rotate first; everything else is second.*
2. **Unauthenticated RCE via the terminal service** (SEC-1..6/FE-1, critical) — no auth or origin check, attacker-controlled file write, unsandboxed `java` with inherited env, publicly reachable through `/ws/terminal` (`routers/terminal.py:24-29`), and running in production via `startup.sh:88-91`.
3. **Deploy pipeline you can't trust** (FE-2/3/7/8, critical/high) — backend health checks pass on the *previous* build (`--async true` + immediate poll); the frontend workflow zips a deleted `server.js`, so that pipeline is likely broken today; `'**.py'` means editing a test deploys production; terminal-service changes never deploy at all.
4. **Broad unauthenticated/unmetered surface** (SEC-7..13, SEC-21, high) — self-registration as teacher, conversation history read/delete for any `user_id`, LLM endpoints with no auth or rate limit (cost exposure), an open SSRF proxy, classroom files viewable across classrooms.
5. **Zero backend unit tests + silent failure habits** (FE-15, BE-3, BE-14) — the entire API surface is untested; migrations swallow errors and report success; 28 catch-alls convert everything to generic 500s. Changes to a live-deploying repo are flown blind.

### Top 5 opportunities

1. **Rotate + batch the Phase-1 security fixes** — one reviewed backend deploy removes most of the critical/high risk at S/M effort per item (proposal, option B Phase 1).
2. **First backend tests + CI that tells the truth** — `dev-requirements.txt`, `pytest.ini`, auth/role unit tests, and the one-commit CI repair (AUD-2) turn every future deploy from a gamble into a checked step. Highest credibility-per-hour for a portfolio repo.
3. **Portfolio surface is 80% there** — an accurate README, this analysis, the NLI monitor, and the docs/ tree are already a strong story; what's missing is tests and the security narrative ("found, fixed, verified" reads far better than "unfixed").
4. **Cheap performance wins** — batching the N+1s (BE-8..10), unblocking the event loop (BE-11/12), two missing DB indexes (GAP-4): each S/M effort with user-visible effect on teacher analytics pages.
5. **RAG quality made measurable** — a small golden-question eval harness (GAP-3) plus unifying the two divergent chunkers (GAP-2) makes the headline feature demonstrably good, not just plausibly good.

## Architecture overview

```
                       ┌────────────────────────────────────────────────┐
                       │                  Browser (user)                │
                       └───────┬──────────────────────────┬─────────────┘
                               │ HTTPS                    │ WSS /ws/terminal
                               ▼                          ▼
   ┌───────────────────────────────────┐   ┌─────────────────────────────────────┐
   │ Azure App Service: frontend       │   │ Azure App Service: backend          │
   │ codetutor-frontend-hei            │   │ codetutor-fyp-hei                   │
   │ CRA static build (+ Node serve)   │   │ startup.sh → gunicorn, 1 worker     │
   └───────────────────────────────────┘   │  ├─ FastAPI main.py (13 routers)    │
                                           │  │   routers/ → services/ → DB      │
      REACT_APP_API_BASE ─────────────────▶│  │   ├─ RAG: FAISS (vectorstore/,   │
                                           │  │   │   committed) + HKBU GenAI API │
                                           │  │   │   + NLI faithfulness monitor  │
                                           │  │   ├─ classroom RAG: embeddings    │
                                           │  │   │   stored in Postgres, FAISS   │
                                           │  │   │   index rebuilt per classroom │
                                           │  │   └─ code exec: Paiza.io API      │
                                           │  └─ terminal-service (node, :3001,  │
                                           │     child_process javac/java)       │
                                           │     ◀─ proxied by /ws/terminal      │
                                           └──────────────┬──────────────────────┘
                                                          │ SQLAlchemy
                                                          ▼
                                           ┌─────────────────────────────┐
                                           │ Azure PostgreSQL            │
                                           │ (users, classrooms, files   │
                                           │  as blobs, chunks+embeddings,│
                                           │  attempts, NLI logs)        │
                                           └─────────────────────────────┘

 Deploy path (the dangerous part):
   git push to main
     ├─ backend.yml  : paths '**.py', requirements.txt, startup.sh, routers/**,
     │                 services/**, core/**, vectorstore/**, practical_tests/**
     │                 → zip whole repo → az webapp deploy --async → health poll
     │                 (poll can pass on the PREVIOUS build — FE-7)
     └─ frontend.yml : paths frontend/**, stale root public/**, src/**, package.json
                       → zips deleted server.js (FE-3 — likely broken today)
```

Data flow for the headline feature: student question → router (`routers/rag.py`) → retriever over committed FAISS stores (`vectorstore/`, MMR with `k`/`fetch_k`/`lambda_mult`) → prompt → HKBU GenAI API → answer → NLI faithfulness check logged to `nli_monitoring_log` → admin dashboard stats (`routers/admin.py:198`).

## Findings by area

Severity counts from the verified audit + gap pass: **10 critical, 21 high, 29 med, 21 low** (81 distinct findings after de-duplicating cross-references; full tables with evidence and per-finding fixes live in `docs/plans/active/codebase-audit.md`). Summary by area:

| Area | Crit | High | Med/Low | Signature findings (ID, effort, deploy-on-push) |
|---|---|---|---|---|
| Secrets | 1 | — | 1 | BE-1 leaked DB admin DSN (S, backend); SEC-22 tracked `frontend/.env.*` to confirm (S, frontend) |
| Terminal / RCE | 5 | 1 | 1 | SEC-1..5 unauth ws + file write + unsandboxed java (S–L, backend); SEC-6 port exposed (S); FE-20 boot-time `npm install` (S) |
| AuthN/AuthZ | — | 5 | 6 | SEC-7 self-register as teacher (S); SEC-10 cross-classroom file access (S); SEC-11/12/21 unauthenticated endpoints (S–M); SEC-14/16/17 login limits, password policy, 7-day JWTs (S–M); GAP-8 `require_role` unused (M) |
| API hardening | — | 3 | 5 | SEC-8 CORS `*`+credentials (S); SEC-9/BE-4 tracebacks to clients (S); SEC-13/BE-12 SSRF proxy (M); SEC-19 JWT in URL (M); SEC-20 upload checks (M) |
| Reliability / migrations | 2 | — | 4 | BE-2 Postgres-only SQL on SQLite default (M); BE-3 failures reported as success (S); BE-21 two divergent migration paths (L); BE-15/16 swallowed HTTPException, broken `PDF_DIR` (S) |
| Performance | — | 7 | 4 | BE-7 48 unbounded `.all()` (M); BE-8..10 N+1 loops (S–M); BE-11/12 blocking calls on the loop (S); GAP-4 missing indexes (S); GAP-13 single worker + heavy slug (M) |
| RAG quality | — | 2 | 3 | BE-5/6 shared chain singletons / thread-safety (M); GAP-2 divergent chunkers (M); GAP-3 no repeatable eval (M); BE-22 degradation gap is LLM-failure mode, not missing try/except (M) |
| CI/CD | 2 | 2 | 5 | FE-3 frontend zip of deleted file (M); FE-2 terminal-service never deploys (S); FE-7/11 health checks validate old build (S); FE-8 `'**.py'` over-match (S); FE-9/GAP-9 stale filters (S) |
| Frontend | — | 2 | 8 | FE-4 XSS via `dangerouslySetInnerHTML` ×3 files (M); FE-5 JWT in localStorage, 176 refs (L); GAP-11/12 duplicated API logic ×18 files, near-duplicate topic pages (M); FE-16/18/19 broken test stub, 145 console.*, a11y labels (S–M) |
| Tests | — | 1 | 1 | FE-15 zero backend unit tests; test deps in no manifest (S to start) |
| Observability | — | — | 2 | GAP-6 193 `print(` vs 5 loggers, no request IDs (M); BE-25 stdout noise (S) |
| Dependencies | — | — | 4 | FE-13 `python-multipart` ReDoS-class (S); FE-17 bcrypt/ML bumps (M); FE-14 CRA unmaintained (L); GAP-10 duplicate pin (S) |
| Architecture / docs | — | — | 4 | GAP-1 logic in 3121/2069-line routers (L); GAP-7 route-naming mix (M); BE-23 README references absent script (S); KI-6 same (S) |

## What is good — keep it

- **NLI faithfulness monitoring** (`services/nli_monitor.py`, logged to DB, admin dashboard at `routers/admin.py:198`) — a real hallucination guard, rare even in production RAG systems. Portfolio gold; extend it (GAP-3) rather than touch it.
- **Well-architected startup** (`main.py` lifespan): migrations, NLI pre-warm and FAISS loading offloaded to an executor with timeouts; nothing heavy at import time. The audit confirmed all other `SessionLocal()` uses close properly.
- **Committed vectorstores for fast Azure boot** — unusual but deliberate and documented; avoids a rebuild on every cold start.
- **Clean secrets posture everywhere else**: apart from BE-1, config is env-only, the `SECRET_KEY` fallback refuses to sign, CI uses `${{ secrets.* }}` correctly.
- **Role model is sound in design** — `require_role()` exists (`routers/auth.py:148`), teacher/student/admin separation is modeled; enforcement just needs to be made uniform.
- **MMR retrieval with tuned parameters** (`rag_system.py:304-306`) and per-request single-thread chain execution (`rag_system.py:378-385`) show the RAG path was thought about, not pasted.
- **The docs/ tree** (OPS runbook, module guides, plans, backlog, decision log) — recent work, accurate, and the reason this analysis could be verified quickly.
- **Threaded migration of uploads into per-classroom RAG** with persisted embeddings (`services/classroom_rag.py`) — the design (embeddings in Postgres, FAISS rebuilt per classroom) is reasonable at this scale; it needs bounds (BE-19), not redesign.
