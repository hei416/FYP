# terminal-service/ — interactive Java terminal (ws)

Node.js WebSocket server (`server.js`, port 3001) that compiles and runs student Java with plain `child_process` (`execFile`/`spawn`) — **no node-pty**, no native rebuild step. Full guide: [docs/modules/code-playground.md](../docs/modules/code-playground.md).

## Rules — this folder is security-sensitive

- It executes untrusted code with no auth and no sandbox (audit SEC-1..6). Nothing is live, so this is a **first-deploy gate**, not a live fire — but any change here must not widen exposure: bind to localhost only, and don't add features before the SEC-2/3/5/6 hardening lands.
- The backend-side proxy (`backend/routers/terminal.py`) is disabled by default via `ENABLE_TERMINAL=false` (owner decision AUD-1). Leave the default off.
- `terminal-service/**` matches the latent **backend** deploy filter — never push (root hard rule 1).

## Commands

- Run: `npm install && node server.js` (from this folder)
- Frontend pairing: `REACT_APP_TERMINAL_WS` (build-time CRA var, default `ws://localhost:3001`); for the backend proxy path also `export ENABLE_TERMINAL=true` before starting the backend
- Offline test of the gate: `backend/tests/test_terminal_proxy.py` (see [backend/tests/AGENTS.md](../backend/tests/AGENTS.md))
