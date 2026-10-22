# Code playground (execution + interactive terminal)

**Batch execution:** `routers/code_execution.py` submits Java code to the external **Paiza** API (`PAIZA_API_KEY` env var). Rate-limited 20 req/min via slowapi.

**Interactive stdin (Scanner etc.):** `terminal-service/` — a Node.js ws server using `node-pty` on port 3001. The frontend connects via `REACT_APP_TERMINAL_WS` (build-time CRA var, default `ws://localhost:3001`). `routers/terminal.py` is the backend-side piece.

**Run locally:** `cd terminal-service && npm install && node server.js`. Optional combined script: `npm run dev:with-terminal` in `frontend/` (uses `concurrently`).

**Production cautions:**
- `node-pty` ships native binaries — on Azure: `npm rebuild node-pty --update-binary`.
- Bind terminal-service to **localhost only**; it is not proxied through the backend in production yet (known issue / security risk — see backlog).

**How to test:** needs the full running stack (frontend + backend + terminal-service); E2E flows live in `tests/`. There are no offline tests for this module.
