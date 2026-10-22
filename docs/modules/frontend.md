# Frontend

Create-React-App in `frontend/` (dev server :3000, talks to the backend at :8000). A deployed instance has no CRA server: `npm run build` output is served by the backend process itself (single-process mode, 2026-10-23).

**Commands:** `npm install`, `npm start` (dev), `npm run build` (production build — also the standard verification for frontend changes), `CI=true npm test -- --watchAll=false` (react-scripts/jest; green since FE-16 — the `jest.moduleNameMapper` in `package.json` and the TextEncoder polyfill in `src/setupTests.js` keep react-router 7 resolvable under jest 27; don't remove them).

**Env:** CRA `REACT_APP_*` variables are **baked in at build time**. `frontend/.env.development` and `.env.production` are git-tracked — hands off: do not read, edit, or move them (hard rule in [/AGENTS.md](../../AGENTS.md)).

**Deploy (latent):** any push to `main` touching `frontend/**` (or the stale root filters `public/**`, `src/**`, `package.json`) fires the frontend workflow, which would build and deploy the frontend App Service — nothing is believed live (owner statement 2026-10-22; see `docs/OPS.md` §Deploy mechanics), but the trigger may still be armed. The root-level `public/` directory is a legacy leftover — **leave it in place** (owner decision, 2026-10-22); moving it would trip the stale CI filter.

**Known clutter:** `frontend/src/TeacherClassroomDetail.js.bak` (116 KB) is tracked — owner decided to leave it for now (backlog).

**How to test:** `npm run build` must pass and `CI=true npm test -- --watchAll=false` must be green (2 suites / 6 tests: Navbar smoke test, localStorage cleanup); Playwright E2E in `backend/tests/` covers key flows but needs the full running stack.
