# Decision log

Append-only. One entry per decision, newest at the bottom. Never edit or delete existing entries. Entries are added only with owner-confirmed wording.

Entry format:

```
## YYYY-MM-DD — <short decision title>
- **Decision:** what was decided
- **Reason:** why
- **Decided by:** owner
```

<!-- Append entries below this line. Do not modify anything above it. -->

## 2026-10-22 — No code moves in reorg
- **Decision:** The FastAPI backend stays at the repo root; the reorg moves no code.
- **Reason:** PROJECT_ROOT derivation, startup.sh's runtime search, the deploy zip layout, and the CI path filters all assume the flat layout — moving code risks the live deployment for cosmetic gain.
- **Decided by:** owner

## 2026-10-22 — Leave root public/ and the .bak file; agents never edit CI
- **Decision:** Root `public/` and `frontend/src/TeacherClassroomDetail.js.bak` stay in place; agents never edit the GitHub Actions workflows.
- **Reason:** Both paths match live deploy filters (`public/**`, `frontend/**`); CI changes are owner-reviewed only.
- **Decided by:** owner

## 2026-10-22 — Vector stores remain committed
- **Decision:** The FAISS binaries in `vectorstore/` stay committed in git.
- **Reason:** Fast production startup on Azure (Option B); documented in `.gitignore`.
- **Decided by:** owner

## 2026-10-22 — AGENTS.md is the single agent entry point
- **Decision:** `AGENTS.md` holds all agent instructions; `CLAUDE.md` is a one-line `@AGENTS.md` import.
- **Reason:** One source of truth readable by all tools; a root CLAUDE.md shadows AGENTS.md in Claude Code, so the import bridges the two (documented pattern).
- **Decided by:** owner

## 2026-10-22 — Improvement option B adopted as the baseline
- **Decision:** Option B (balanced: security, reliability, tests, portfolio polish) from `docs/reports/improvement-proposal-2026-10-22.md` is the working plan — everything in Option A, then the three batched owner-reviewed pushes (security; reliability/perf; frontend) plus the deploy-inert tests/eval/docs work. The two Option C elements held in reserve (CI pytest gate, staging slot) are decided separately later.
- **Reason:** The purpose is maintain + portfolio with no deadline: B closes every critical/high finding, gives the backend its first real tests, and is the strongest outcome per hour; A leaves the audit a list of known-but-unfixed holes, and C's extra credit over B comes mostly from parts B already captures in lighter form.
- **Decided by:** owner

## 2026-10-22 — backend/ restructure stays propose-only
- **Decision:** The move of the backend into `backend/` remains a propose-only move map in `docs/reports/improvement-proposal-2026-10-22.md` (proposal decision #9) — it is not part of the adopted Option B, and no agent executes it without a separate owner decision.
- **Reason:** The restructure changes every path the live deploy depends on at once (PROJECT_ROOT derivation, `startup.sh`, CI filters, zip layout) for mostly cosmetic gain, and is the only part of Option C with real rollback pain; it would require a staging rehearsal first. Consistent with the existing "No code moves in reorg" decision.
- **Decided by:** owner

## 2026-10-23 — Stay on JavaScript; TypeScript migration deferred
- **Decision:** The frontend stays on JavaScript for now. A TS migration is deferred until after the critical security fixes from the 2026-10-23 bug audit (`docs/reports/2026-10-23_bug-audit.md`) are landed. If resumed later, the agreed sequencing is: dead-code cleanup → CRA→Vite toolchain move → incremental TS starting at the API/service layer (`classroomService.js`, `progressService.js`), with new files written in TS. No full rewrite of the large page components.
- **Reason:** The critical risk (6 critical security findings) sits in the Python backend and terminal-service, which TS does not address. The frontend is ~21k LOC of untyped React on deprecated CRA 5 with effectively no tests and no CI lint/test gate, so a migration now would be high-cost and unprotected. The existing `frontend/tsconfig.json` is an inert 62-byte stub (no TS dependency, no `.ts` files), not a partial migration. ~11% of frontend LOC is dead code (`TeacherClassroomDetail.js.bak`, abandoned parallel implementation under `pages/`, `services/`, `components/`) that should be cleaned up regardless, before any migration.
- **Decided by:** owner (wording confirmed 2026-10-23)
