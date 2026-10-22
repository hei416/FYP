# Code playground (execution + interactive terminal)

**Batch execution:** `backend/routers/code_execution.py` submits Java code to the external **Paiza** API (`PAIZA_API_KEY` env var). Rate-limited 20 req/min via slowapi.

**Interactive stdin (Scanner etc.):** `terminal-service/` — a Node.js ws server using plain `child_process` (`javac`/`java` via `execFile`/`spawn`; no node-pty) on port 3001. The frontend connects via `REACT_APP_TERMINAL_WS` (build-time CRA var, default `ws://localhost:3001`). `backend/routers/terminal.py` is the backend-side piece.

**`ENABLE_TERMINAL` flag (AUD-1, owner decision 2026-10-22):** the backend `/ws/terminal` proxy is **disabled by default**. `backend/core/config.py` reads `ENABLE_TERMINAL` (default `false`); when off, `backend/routers/terminal.py` rejects the WebSocket handshake with HTTP 403 (close code 1008, reason "Terminal disabled") before proxying anything. No code was deleted — set `ENABLE_TERMINAL=true` and restart to re-enable, but only after the terminal-service hardening (audit SEC-2/3/5/6).

**Impact in a deployed instance when the flag is off** (owner states nothing is currently live — 2026-10-22, see `docs/OPS.md` §Deploy mechanics): the in-browser interactive Java terminal (Scanner/stdin) **does not work**. What the user sees: `Compiler.js` attempts the WebSocket only when the build-time `REACT_APP_TERMINAL_WS` var is set; the rejected handshake fires `ws.onerror`, the output panel shows `[WebSocket error — retrying via HTTP]`, and the run falls back to batch execution via the Paiza API — output still appears, but programs that read stdin interactively cannot run. (Today's CI build does not set `REACT_APP_TERMINAL_WS` at all — FE-10 — so a CI-built Compiler takes the HTTP path; `InteractiveTerminal.jsx` hardcodes `ws://localhost:3001` (SEC-24) and never used the proxy.)

**Run locally:** `cd terminal-service && npm install && node server.js`. Optional combined script: `npm run dev:with-terminal` in `frontend/` (uses `concurrently`). For the proxy path, also export `ENABLE_TERMINAL=true` before starting the backend.

**Production cautions:**
- No native binaries to rebuild: the service uses plain `child_process` (the old `npm rebuild node-pty` Azure step is obsolete — no PTY dependency exists in `terminal-service/package.json`).
- Bind terminal-service to **localhost only**; in any deployment it would not be proxied through the backend yet (known issue / security risk — see backlog). With nothing deployed (owner statement 2026-10-22) this is a **first-deploy gate**, not a live fire — see `docs/plans/active/first-deploy-readiness.md`.

**How to test:** the `ENABLE_TERMINAL` gate has an offline test — `cd backend && python -m pytest tests/test_terminal_proxy.py -q` (FastAPI TestClient only, no network; see docs/OPS.md §Tests). Everything else needs the full running stack (frontend + backend + terminal-service); E2E flows live in `backend/tests/`.
