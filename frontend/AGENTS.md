# frontend/ — CRA React app

Create-React-App (dev server :3000; talks to the backend at :8000 and terminal-service at :3001). Full guide: [docs/modules/frontend.md](../docs/modules/frontend.md).

## Rules

- **`.env.development` / `.env.production` are git-tracked — do not read, edit, or move them** (root [/AGENTS.md](../AGENTS.md) hard rule 3).
- `REACT_APP_*` vars are baked in **at build time** — changing one needs a rebuild, not a restart.
- Don't remove the `jest.moduleNameMapper` in `package.json` or the TextEncoder polyfill in `src/setupTests.js` — they keep react-router 7 resolvable under jest 27 (FE-16).
- `src/TeacherClassroomDetail.js.bak` is tracked clutter — owner decided to leave it (backlog).
- Any `frontend/**` change matches the latent frontend deploy filter — never push (hard rule 1). The legacy root-level `public/` also stays in place (stale CI filter).

## Commands (from this folder)

- `npm install`, then `npm start` (dev)
- Verify a change: `npm run build` must pass, and `CI=true npm test -- --watchAll=false` must stay green (2 suites / 6 tests)
- `npm run dev:with-terminal` starts the dev server plus terminal-service together
