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
