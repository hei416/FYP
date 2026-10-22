# Code playground (Java execution)

**One execution path since 2026-10-23** (owner decision — single-process collapse). All Java
execution goes through `backend/routers/code_execution.py`, which submits the code to the external
**Paiza** API (`PAIZA_API_KEY` env var). Rate-limited 20 req/min via slowapi.

## Endpoints

| Endpoint | Purpose |
|---|---|
| `POST /api/run-code` | Compile + run; accepts `files[]`, optional `input` (stdin) |
| `POST /api/check-syntax` | Compile-only; returns parsed `javac` errors for Monaco markers |
| `POST /api/explain-error` | LLM explanation of a compiler error (authenticated, cached) |

## stdin

Execution is **one-shot**, not interactive: `input` is sent with the request and the program runs to
completion. `frontend/src/Compiler.js` shows a "Program input (stdin)" textarea — one line per
`nextLine()` call — whenever the source matches `Scanner` / `BufferedReader` / `System.in`, and
passes its contents as `input`. The backend substitutes a single newline when `input` is empty, so
`Scanner.nextLine()` cannot throw `NoSuchElementException` on an empty stdin.

## What was removed, and why

The Node `terminal-service/` (ws on :3001) and the backend proxy `routers/terminal.py` were deleted
2026-10-23. They were the only path offering **live** stdin — typing into a running JVM — and they
cost a second runtime, a second port, a second deploy target and an unauthenticated, unsandboxed
`javac`/`java` surface (audit SEC-1..6). The owner accepted losing live stdin in exchange for a
single-process app. The functional loss is narrow: programs that interleave prompts and input still
run, they just read their whole input up front.

Two facts made the trade cheap:

- `ENABLE_TERMINAL` already defaulted to **off** (AUD-1, 2026-10-22), so the proxy was inert anyway.
- `InteractiveTerminal.jsx` hardcoded `ws://localhost:3001` (SEC-24), bypassing both the flag and
  the proxy — the interactive terminal was dev-only and already broken in any deployed instance.

Reintroducing live execution would mean re-opening SEC-1..6 (sandboxing, authentication, resource
limits). Do not add a WebSocket exec route without that work.

## How to test

`cd backend && python -m pytest tests/test_single_process_spa.py -q` covers the SPA mount that
replaced the terminal routes. Playground E2E flows need the running stack (frontend + backend only
now) and live in `backend/tests/`.
