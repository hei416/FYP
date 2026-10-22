import os
import re
import httpx
import asyncio
import logging
from fastapi import APIRouter, Request, Depends
from database import get_db
from sqlalchemy.orm import Session
from services.error_explainer import get_cached_explanation, store_explanation, build_explain_prompt
from routers.rag import call_llm
from core.rate_limiter import limiter
from typing import List, Dict

logger = logging.getLogger(__name__)

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
    # Prefer public class
    match = re.search(r'public\s+class\s+([a-zA-Z0-9_]+)', code)
    if match:
        return match.group(1)
    # Fall back: find the class that contains the main method
    main_pos = code.find('public static void main')
    if main_pos != -1:
        classes = list(re.finditer(r'\bclass\s+([a-zA-Z0-9_]+)', code))
        last_before_main = None
        for m in classes:
            if m.start() < main_pos:
                last_before_main = m
        if last_before_main:
            return last_before_main.group(1)
    # Fall back: first class found
    match = re.search(r'\bclass\s+([a-zA-Z0-9_]+)', code)
    if match:
        return match.group(1)
    return 'Main'


def validate_filename_class(filename: str, source: str):
    """Returns an error string if filename doesn't match public class name, else None."""
    class_name = extract_class_name(source)
    expected_filename = f"{class_name}.java"
    if filename != expected_filename:
        return (
            f"Class name mismatch: class '{class_name}' must be in a file named "
            f"'{expected_filename}', but the file is named '{filename}'."
        )
    return None


def _build_source_from_files(files: List[Dict]) -> str:
    if len(files) == 1:
        return files[0].get("content", "")
    for f in files:
        if re.search(r'public\s+class\s+', f.get("content", "")):
            return f.get("content", "")
    return files[0].get("content", "")


def normalize_public_class(source: str, target_name: str = "Main") -> str:
    """Return a version of `source` where the entry-point class declaration and
    identifier occurrences are renamed to `target_name` so that compilers
    that expect the file to be named Main.java (e.g. Paiza) can compile it.
    Handles both `public class X` and non-public `class X` declarations.
    """
    # Nothing to do if public class Main already exists
    if re.search(r'\bpublic\s+class\s+' + re.escape(target_name) + r'\b', source):
        return source

    class_name = extract_class_name(source)

    # Replace 'public class X' or plain 'class X' → 'public class Main'
    new_source = re.sub(r"\bpublic\s+class\s+" + re.escape(class_name),
                        f"public class {target_name}", source, count=1)
    if new_source == source:
        # Non-public class — add public modifier
        new_source = re.sub(r"\bclass\s+" + re.escape(class_name) + r"\b",
                            f"public class {target_name}", source, count=1)
    source = new_source

    # Rename remaining references to the old class name
    if class_name != target_name:
        source = re.sub(r"\b" + re.escape(class_name) + r"\b", target_name, source)
    return source


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
@limiter.limit("20/minute")
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
    filename = files[0].get("filename", "Main.java")

    # Enforce: filename must match public class name
    mismatch_error = validate_filename_class(filename, source)
    if mismatch_error:
        return {"output": "", "error": mismatch_error}

    class_name = extract_class_name(source)

    # Inject runner if no main() but runApp() exists
    # Supports both 'public void runApp()' and package-private 'void runApp()'
    has_runapp = re.search(r'\bvoid\s+runApp\s*\(', source) is not None
    if "public static void main" not in source and (has_runapp or "runApp(" in source):
        runner = f"\n\nclass Runner {{\n    public static void main(String[] args) {{\n        new {class_name}().runApp();\n    }}\n}}\n"
        source = source.rstrip() + "\n\n" + runner

    if len(source.encode("utf-8")) > MAX_SOURCE_BYTES:
        return {"output": "", "error": "Source code too large to execute"}

    # Normalize public class to `Main` for the external executor (Paiza)
    paiza_source = normalize_public_class(source, "Main")

    # Ensure the external executor always receives at least one newline when
    # no explicit stdin is provided. This prevents student programs that call
    # Scanner.nextLine() from throwing NoSuchElementException in sandboxed
    # environments where System.in may be closed/empty.
    input_value = data.get("input")
    if input_value is None or input_value == "":
        input_value = "\n"

    payload = {
        "source_code": paiza_source,
        "language": "java",
        "input": input_value,
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

                # Enforce: filename must match public class name
                # For syntax checking we want to report the mismatch but still
                # run the compiler to collect other errors (e.g. missing semicolons).
                mismatch_error = validate_filename_class(filename, source)
                if mismatch_error:
                    # Try to report the actual line number of the public class
                    source_lines = source.splitlines()
                    mismatch_line = next(
                        (i + 1 for i, l in enumerate(source_lines) if re.search(r'public\s+class\s+', l)),
                        1  # fallback to 1 if not found
                    )
                    all_errors.append({
                        "file": filename, "line": mismatch_line, "column": 0,
                        "severity": "error", "message": mismatch_error
                    })
                    # do NOT `continue` here — keep collecting other errors below

                try:
                    # Normalize public class to `Main` for the external executor
                    source_for_paiza = normalize_public_class(source, "Main")
                    resp = await client.post(PAIZA_CREATE, data={
                        "source_code": source_for_paiza,
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


@router.post("/api/explain-error")
async def explain_error(request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    error_message = data.get("error_message", "").strip()
    code_snippet  = data.get("code_snippet", "")
    line_number   = data.get("line_number", 0)

    if not error_message:
        return {"explanation": "No error message provided."}

    # 1. Check cache first
    cached = get_cached_explanation(db, error_message)
    if cached:
        return {"explanation": cached, "cached": True}

    # 2. Call AI
    prompt = build_explain_prompt(error_message, code_snippet, line_number)
    try:
        explanation = await call_llm([{"role": "user", "content": prompt}], temperature=0.2, max_tokens=200)
    except Exception as e:
        return {"explanation": f"Could not generate explanation: {str(e)}"}

    # 3. Store in cache
    try:
        store_explanation(db, error_message, explanation)
    except Exception:
        pass

    return {"explanation": explanation, "cached": False}
