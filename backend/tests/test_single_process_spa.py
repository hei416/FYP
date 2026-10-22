"""Offline tests for the single-process SPA mount (owner decision 2026-10-23).

One process serves the API and the built React SPA. These tests pin the two
properties that make that safe:
  * the catch-all must never shadow an API route, /docs or /openapi.json;
  * a traversal path must not escape the build directory.

Run from backend/: python -m pytest tests/test_single_process_spa.py -q
"""
import importlib
import os
import sys

import pytest
from starlette.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("SECRET_KEY", "offline-test-signing-key-not-a-secret")


@pytest.fixture(scope="module")
def build_dir(tmp_path_factory):
    d = tmp_path_factory.mktemp("build")
    (d / "index.html").write_text("<!doctype html><title>SPA</title>")
    (d / "static").mkdir()
    (d / "static" / "app.js").write_text("console.log('app')")
    return d


def _reimport_main():
    """Re-import `main` so the SPA mount re-evaluates FRONTEND_BUILD_DIR.

    Dropping `core.config` from sys.modules is not enough: `from core import
    config` resolves the already-bound attribute on the cached `core` package,
    so the attribute has to go too or a stale config is handed back (this only
    shows up when another test module imported main first).
    """
    import core

    sys.modules.pop("main", None)
    sys.modules.pop("core.config", None)
    if hasattr(core, "config"):
        del core.config
    return importlib.import_module("main")


@pytest.fixture(scope="module")
def spa_client(build_dir):
    """Import main with a build directory present, then restore the module."""
    previous = os.environ.get("FRONTEND_BUILD_DIR")
    os.environ["FRONTEND_BUILD_DIR"] = str(build_dir)
    main = _reimport_main()
    try:
        yield TestClient(main.app)
    finally:
        # Restore rather than unset: unsetting falls back to the default
        # <repo>/frontend/build, which exists once anyone has run a build.
        if previous is None:
            os.environ.pop("FRONTEND_BUILD_DIR", None)
        else:
            os.environ["FRONTEND_BUILD_DIR"] = previous
        _reimport_main()


def test_root_serves_the_spa(spa_client):
    r = spa_client.get("/")
    assert r.status_code == 200
    assert "<title>SPA</title>" in r.text


def test_client_side_route_falls_back_to_index(spa_client):
    """A hard refresh on /playground must return index.html, not a 404."""
    r = spa_client.get("/playground")
    assert r.status_code == 200
    assert "<title>SPA</title>" in r.text


def test_build_assets_are_served(spa_client):
    r = spa_client.get("/static/app.js")
    assert r.status_code == 200
    assert "console.log" in r.text


@pytest.mark.parametrize("path", ["/health", "/api/status", "/docs", "/openapi.json"])
def test_api_routes_win_over_the_catch_all(spa_client, path):
    r = spa_client.get(path)
    assert r.status_code == 200
    assert "<title>SPA</title>" not in r.text


def test_traversal_cannot_escape_the_build_dir(spa_client):
    r = spa_client.get("/%2e%2e/%2e%2e/%2e%2e/etc/passwd")
    assert r.status_code == 200
    assert "root:" not in r.text
    assert "<title>SPA</title>" in r.text


def test_terminal_proxy_is_gone(spa_client):
    """The ws proxy retired with terminal-service — no route may remain."""
    paths = [r.path for r in spa_client.app.routes if hasattr(r, "path")]
    assert "/ws/terminal" not in paths


def test_empty_build_dir_degrades_to_api_only(tmp_path):
    """A placeholder build dir with no index.html must not mount the SPA.

    Container images ship `frontend_build/` as a committed placeholder so the
    Dockerfile COPY always has a source; a hand-run `docker build` leaves it
    empty. That must give an API-only app, not a 500 on every page.
    """
    previous = os.environ.get("FRONTEND_BUILD_DIR")
    os.environ["FRONTEND_BUILD_DIR"] = str(tmp_path)  # exists, but no index.html
    try:
        main = _reimport_main()
        paths = [r.path for r in main.app.routes if hasattr(r, "path")]
        assert "/{full_path:path}" not in paths
        assert TestClient(main.app).get("/health").json() == {"status": "ok"}
    finally:
        if previous is None:
            os.environ.pop("FRONTEND_BUILD_DIR", None)
        else:
            os.environ["FRONTEND_BUILD_DIR"] = previous
        _reimport_main()
