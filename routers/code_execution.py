import os
import re
import httpx
import asyncio
from fastapi import APIRouter, Request
from typing import List, Dict

router = APIRouter()

PAIZA_CREATE  = "https://api.paiza.io/runners/create"
PAIZA_DETAILS = "https://api.paiza.io/runners/get_details"
PAIZA_STATUS  = "https://api.paiza.io/runners/get_status"
MAX_SOURCE_BYTES = 50_000


async def _wait_for_completion(client: httpx.AsyncClient, session_id: str, api_key: str, max_retries: int = 10) -> bool:
    for _ in range(max_retries):
        r = await client.get(PAIZA_STATUS, params={"id": session_id, "api_key": api_key}, timeout=10)
        r.raise_for_status()
        if r.json().get("status") == "completed":
            return True
        await asyncio.sleep(1)
    return False


def extract_class_name(code: str) -> str:
    match = re.search(r'public\s+class\s+([a-zA-Z0-9_]+)', code)
    return match.group(1) if match else 'Main'


def _build_source_from_files(files: List[Dict]) -> str:
    if len(files) == 1:
        return files[0].get("content", "")
    # For multiple files, find the one containing the public class and use it as
    # the primary source. Paiza only supports a single file, so we pick the file
    # that declares a public class to avoid the
    # "class X is public, should be declared in a file named X.java" error.
    for f in files:
        if re.search(r'public\s+class\s+', f.get("content", "")):
            return f.get("content", "")
    return files[0].get("content", "")


def parse_javac_errors(build_stderr: str, filename: str) -> list[dict]:
    errors = []
    for line in build_stderr.splitlines():
        m = re.match(r'([^:]+\.java):(\d+):\s*(error|warning):\s*(.+)', line)
        if m:
            errors.append({
                "file": filename,
                "line": int(m.group(2)),
                "column": 0,
                "severity": m.group(3),
                "message": m.group(4).strip(),
            })
    return errors


@router.post("/api/run-code")
async def run_code(request: Request):
    data = await request.json()
    files = data.get("files", [])

    if not files and "code" in data:
        code = data["code"]
        files = [{"filename": f"{extract_class_name(code)}.java", "content": code}]

    if not files:
        return {"output": "", "error": "No code provided"}

    paiza_key = os.environ.get("PAIZA_API_KEY") or "guest"
    source = _build_source_from_files(files)

    if len(source.encode("utf-8")) > MAX_SOURCE_BYTES:
        return {"output": "", "error": "Source code too large to execute"}

    payload = {
        "source_code": source,
        "language": "java",
        "input": data.get("input", ""),
        "api_key": paiza_key,
        "longpoll": "true",
        "longpoll_timeout": "20",
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(PAIZA_CREATE, data=payload, timeout=60)
            resp.raise_for_status()
            session = resp.json()

            session_id = session.get("id")
            if not session_id:
                return {"output": "", "error": "No session ID returned from executor"}

            if session.get("status") != "completed":
                completed = await _wait_for_completion(client, session_id, paiza_key)
                if not completed:
                    return {"output": "", "error": "Execution timed out"}

            detail_resp = await client.get(
                PAIZA_DETAILS,
                params={"id": session_id, "api_key": paiza_key},
                timeout=30,
            )
            detail_resp.raise_for_status()
            result = detail_resp.json()

    except httpx.RequestError as e:
        return {"output": "", "error": f"Execution service unreachable: {str(e)}"}
    except httpx.HTTPStatusError as e:
        detail = ""
        try: detail = e.response.json().get("error", "")
        except Exception: pass
        return {"output": "", "error": f"Execution service error {e.response.status_code}: {detail or str(e)}"}

    build_stderr = result.get("build_stderr") or ""
    stderr       = result.get("stderr") or ""
    stdout       = result.get("stdout") or ""
    return {"output": stdout, "error": build_stderr or stderr}


@router.post("/api/check-syntax")
async def check_syntax(request: Request):
    data = await request.json()
    files = data.get("files", [])

    if not files and "code" in data:
        code = data["code"]
        files = [{"filename": f"{extract_class_name(code)}.java", "content": code}]

    if not files:
        return {"errors": [], "partial": False}

    paiza_key = os.environ.get("PAIZA_API_KEY") or "guest"
    all_errors = []

    try:
        async with httpx.AsyncClient() as client:
            for f in files:
                source   = f.get("content", "")
                filename = f.get("filename", "Main.java")
                if not source.strip():
                    continue
                try:
                    resp = await client.post(PAIZA_CREATE, data={
                        "source_code": source,
                        "language": "java",
                        "input": "",
                        "api_key": paiza_key,
                        "longpoll": "true",
                        "longpoll_timeout": "10",
                    }, timeout=30)
                    resp.raise_for_status()
                    session    = resp.json()
                    session_id = session.get("id")
                    if not session_id:
                        continue

                    if session.get("status") != "completed":
                        await _wait_for_completion(client, session_id, paiza_key, max_retries=6)

                    detail = await client.get(
                        PAIZA_DETAILS,
                        params={"id": session_id, "api_key": paiza_key},
                        timeout=15,
                    )
                    detail.raise_for_status()
                    result = detail.json()

                    build_stderr = result.get("build_stderr") or ""
                    if build_stderr.strip():
                        errors = parse_javac_errors(build_stderr, filename)
                        if not errors:
                            errors = [{
                                "file": filename, "line": 1, "column": 0,
                                "severity": "error", "message": build_stderr.strip()
                            }]
                        all_errors.extend(errors)

                except Exception as e:
                    import traceback
                    print(f"[check-syntax] paiza error for {filename}:", e)
                    traceback.print_exc()

    except Exception as e:
        import traceback
        print("[check-syntax] outer error:")
        traceback.print_exc()

    return {"errors": all_errors, "partial": False}
