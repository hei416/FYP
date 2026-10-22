# CodeTutor — Frontend

Create-React-App UI for the CodeTutor Java learning platform. Platform overview, backend setup, and the full runbook live in the [root README](../README.md) and [docs/OPS.md](../docs/OPS.md).

## Run

```bash
npm install
npm start          # http://localhost:3000 (expects the backend at :8000)
```

Verify a change:

```bash
npm run build                        # must pass
CI=true npm test -- --watchAll=false # must stay green (2 suites / 6 tests)
```

Optional interactive-terminal pairing: `npm run dev:with-terminal` starts the dev server together with `../terminal-service/` (ws://localhost:3001).

## Source layout (since 2026-10-23)

`src/` is organized into `pages/` (route targets), `components/` (embedded UI), `services/` (API clients + `AuthContext` + `ProgressTracker`), `utils/`, and `data/` — placement rules in [src/AGENTS.md](src/AGENTS.md), deeper guide in [docs/modules/frontend.md](../docs/modules/frontend.md).

## Notes

- `REACT_APP_*` env vars are baked in at **build time** — changing one requires a rebuild, not a restart.
- Login is optional: guest progress is saved in `localStorage` and uploaded to the backend on a later login without overwriting completed items. Dev test account: see docs/OPS.md.
- AI quality metrics and the evaluation methodology live in [docs/modules/rag-evaluation.md](../docs/modules/rag-evaluation.md).
