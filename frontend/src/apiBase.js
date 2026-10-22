/**
 * Where the API lives, resolved once for the whole app (GAP-11).
 *
 * Single-process mode (2026-10-23): the backend serves this SPA, so the API is
 * on the *same origin* and a relative base — the empty string — is correct
 * wherever the app is hosted. That is the default.
 *
 * The CRA dev server is the exception: it serves the SPA from :3000 while the
 * backend listens on :8000, a different origin, so the dev fallback points
 * there. `REACT_APP_API_BASE` still wins when set, for anyone running the two
 * halves somewhere else.
 *
 * Note: `REACT_APP_API_BASE` is baked in at build time. A production build that
 * sets it to an absolute host will call that host instead of the origin serving
 * the page — see backlog SP-4.
 */
const CRA_DEV_PORT = '3000';
const DEV_API_BASE = 'http://localhost:8000';

function resolve() {
  const configured = process.env.REACT_APP_API_BASE;
  if (configured) return configured;
  if (typeof window !== 'undefined' && window.location.port === CRA_DEV_PORT) {
    return DEV_API_BASE;
  }
  return ''; // same origin
}

export const API_BASE = resolve();

export default API_BASE;
