# backend/tests/ — offline unit tests + E2E + load

Two very different kinds of tests live here — don't mix them up:

- **Offline suite** (no network, no running services; FastAPI TestClient): `test_security_fixes.py`, `test_single_process_spa.py`, `test_bug_audit_crit_high.py`. Run from `backend/`:
  `python -m pytest tests/ -q --ignore=tests/test_acceptance.py --ignore=tests/test_browser_compat.py --ignore=tests/locustfile.py`
  Deps: `pip install -r backend/requirements-dev.txt`.
- **E2E** (`test_acceptance.py`, `test_browser_compat.py` — Playwright) and **load** (`locustfile.py` — locust): need the full stack running at localhost:3000/8000. Their deps are deliberately **not** in requirements.txt (the deploy zip ships requirements.txt): `pip install playwright locust && playwright install`.

Full test docs: [docs/OPS.md §Tests](../../docs/OPS.md).

## Rules

- New offline tests must stay offline (TestClient, no external calls) and must be picked up by the command above without extra flags.
- A test file here matches the `backend/**` deploy filter — never push (root hard rule 1).
