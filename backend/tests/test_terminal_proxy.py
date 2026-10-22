"""Offline tests for the ENABLE_TERMINAL gate on /ws/terminal (AUD-1).

FastAPI/Starlette TestClient only — no network, no running terminal-service,
no app startup (the test app includes just the terminal router).

Run (deps: pip install pytest — see docs/OPS.md):
    python -m pytest tests/test_terminal_proxy.py -q
"""

import importlib
import json

import pytest
from fastapi import FastAPI
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from core import config
from routers import terminal


@pytest.fixture()
def client():
    app = FastAPI()
    app.include_router(terminal.router)
    return TestClient(app)


def test_flag_defaults_off(monkeypatch):
    """With ENABLE_TERMINAL unset, the flag must be False."""
    monkeypatch.delenv("ENABLE_TERMINAL", raising=False)
    importlib.reload(config)
    assert config.ENABLE_TERMINAL is False


def test_ws_terminal_rejected_when_disabled(client, monkeypatch):
    """Flag off: the handshake is rejected (403) before accept, code 1008."""
    monkeypatch.setattr(config, "ENABLE_TERMINAL", False)
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect("/ws/terminal"):
            pass
    assert exc_info.value.code == 1008


def test_ws_terminal_enabled_still_proxies(client, monkeypatch):
    """Flag on: the proxy accepts and behaves as before — with no
    terminal-service listening it sends the friendly fallback frames."""
    monkeypatch.setattr(config, "ENABLE_TERMINAL", True)
    # Port 1 is never listening — deterministic connection refusal, offline.
    monkeypatch.setattr(terminal, "TERMINAL_SERVICE_WS", "ws://127.0.0.1:1")
    with client.websocket_connect("/ws/terminal") as ws:
        first = json.loads(ws.receive_text())
        assert first["type"] == "output"
        assert "unavailable" in first["data"].lower()
        second = json.loads(ws.receive_text())
        assert second == {"type": "exit", "code": 1}
