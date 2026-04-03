"""
WebSocket proxy — bridges the browser to the local terminal-service (port 3001).

In production (Azure), the browser connects to wss://<host>/ws/terminal and this
proxy forwards all frames bidirectionally to ws://localhost:3001.

In development the browser connects directly to ws://localhost:3001, so this
router is effectively unused but harmless.
"""

import asyncio
import logging

import aiohttp
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

router = APIRouter()

TERMINAL_SERVICE_WS = "ws://localhost:3001"


@router.websocket("/ws/terminal")
async def terminal_proxy(ws: WebSocket):
    await ws.accept()
    try:
        async with aiohttp.ClientSession() as session:
            async with session.ws_connect(TERMINAL_SERVICE_WS) as backend:

                async def client_to_backend():
                    try:
                        while True:
                            text = await ws.receive_text()
                            await backend.send_str(text)
                    except (WebSocketDisconnect, Exception):
                        pass

                async def backend_to_client():
                    try:
                        async for msg in backend:
                            if msg.type == aiohttp.WSMsgType.TEXT:
                                await ws.send_text(msg.data)
                            elif msg.type in (
                                aiohttp.WSMsgType.CLOSED,
                                aiohttp.WSMsgType.ERROR,
                            ):
                                break
                    except Exception:
                        pass

                tasks = [
                    asyncio.create_task(client_to_backend()),
                    asyncio.create_task(backend_to_client()),
                ]
                _, pending = await asyncio.wait(
                    tasks, return_when=asyncio.FIRST_COMPLETED
                )
                for t in pending:
                    t.cancel()

    except aiohttp.ClientConnectorError:
        # Terminal-service is not running — send a friendly error then close.
        try:
            import json
            await ws.send_text(
                json.dumps({
                    "type": "output",
                    "data": "\r\n\x1b[31m[Terminal service unavailable — falling back to HTTP]\x1b[0m\r\n",
                })
            )
            await ws.send_text(json.dumps({"type": "exit", "code": 1}))
        except Exception:
            pass
    except Exception as exc:
        logger.warning("terminal_proxy error: %s", exc)
    finally:
        try:
            await ws.close()
        except Exception:
            pass
