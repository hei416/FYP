# Frontend src restructure (duplicates first, then folders)

## Goal
Remove the dead/diverged duplicate files in `frontend/src` (abandoned half-refactor trap), then reorganize the ~45 flat files at `src/` root into meaningful folders so per-folder docs can cover them.

Owner-approved 2026-10-23 (chat): scope = "Duplicates first, then restructure".

## Why
- `pages/`, `services/`, `components/` were started ~2026-03-28 but abandoned; the app runs on the root copies (last touched 2026-04-14). The subfolder copies are stale and **dead** (nothing imports them) — editing them changes nothing in the running app.
- 45 files flat at `src/` root mix pages, components, services, utils, styles, and content data; no doc can cover that effectively (owner's observation).

## Phase 1 — delete dead duplicates (verified: no static or dynamic importers)
- `src/pages/StudentClassroomDetail.jsx` (stale vs live root copy)
- `src/services/classroomService.js` (stale vs live root copy)
- `src/components/ClassroomFileManager.js` + `.jsx` (both unreferenced)
- Any unique logic in these is unreachable dead code; recoverable from git history.
- NOT touched: `TeacherClassroomDetail.js.bak` (owner decided to keep — frontend/AGENTS.md).

## Phase 2 — restructure src/
Target layout (CRA-conventional files stay at src root: index.js, index.css, App.js, App.css, App.test.js, setupTests.js, reportWebVitals.js):
- `pages/` — route-level components (per App.js routes)
- `components/` — shared/embedded UI
- `services/` — API clients (classroomService, myWorkService, progressService) + AuthContext
- `utils/` — learningPathUtils, ragDocMapping, enhancedRagDocMapping, theme
- `data/` — topicContent.json, enhancedTopicContent.json
- CSS moves with the file that imports it.
- Use `git mv`; rewrite relative imports; update `__tests__/` imports.

## Phase 3 — docs
- Short AGENTS.md in new folders where useful; update `frontend/AGENTS.md` + `docs/modules/frontend.md`.

## Done-criteria / verification
- `npm run build` passes; `CI=true npm test -- --watchAll=false` green (2 suites / 6 tests).
- Secret-scan diff; small logical commits; clean tree.
- All changes match the latent `frontend/**` deploy filter — expected and owner-approved for this task; **never pushed** (hard rule 1 — local branch only, owner pushes).

## Files to touch
`frontend/src/**` (moves + import rewrites), `frontend/AGENTS.md`, `docs/modules/frontend.md`, this plan file.

## Status
- 2026-10-23: Plan created on branch `refactor/frontend-src-structure` (worktree).
- 2026-10-23: DONE. Phase 1 (8b87966): 4 dead duplicates deleted. Phase 2 (f3b672c): 40 files moved into pages/components/services/utils/data, 109 import lines rewritten, build + 6 tests green. Phase 3: frontend/src/AGENTS.md added, frontend/AGENTS.md + docs/modules/frontend.md updated, FE-21 (dead-code candidates) added to backlog. Branch is local-only — NOT merged, NOT pushed (every change matches the frontend deploy filter; owner pushes).
