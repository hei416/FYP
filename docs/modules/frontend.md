# Frontend

Create-React-App in `frontend/` (dev server :3000, talks to the backend at :8000 and terminal-service at :3001).

**Commands:** `npm install`, `npm start` (dev), `npm run build` (production build — also the standard verification for frontend changes), `npm test` (react-scripts; a few `__tests__`).

**Env:** CRA `REACT_APP_*` variables are **baked in at build time**. `frontend/.env.development` and `.env.production` are git-tracked — hands off: do not read, edit, or move them (hard rule in [/AGENTS.md](../../AGENTS.md)).

**Deploy:** any push to `main` touching `frontend/**` (or the stale root filters `public/**`, `src/**`, `package.json`) builds and deploys the live frontend App Service. The root-level `public/` directory is a legacy leftover — **leave it in place** (owner decision, 2026-10-22); moving it would trip the stale CI filter.

**Known clutter:** `frontend/src/TeacherClassroomDetail.js.bak` (116 KB) is tracked — owner decided to leave it for now (backlog).

**How to test:** `npm run build` must pass; Playwright E2E in `tests/` covers key flows but needs the full running stack.
