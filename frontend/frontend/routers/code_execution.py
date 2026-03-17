import tempfile
import os
import re
import requests
from fastapi import APIRouter, Request
from typing import List, Dict
from core.config import PAIZA_API_KEY

router = APIRouter()

def extract_class_name(code: str) -> str:
    """Extract public class name from Java code"""
    match = re.search(r'public\s+class\s+([a-zA-Z0-9_]+)', code)
    return match.group(1) if match else 'Main'

def _ensure_main_method(files: List[Dict], main_class: str) -> List[Dict]:
    """Ensure the main class has runApp + main. If not, auto-generate from declared public no-arg methods."""
    updated_files = []
    for file in files:
        content = file.get("content", "")
        filename = file.get("filename", "")

        class_name_in_file = extract_class_name(content)

        if class_name_in_file == main_class:
            if "public static void main" not in content:
                last_brace_idx = content.rfind('}')
                if last_brace_idx != -1:
                    # Find all public no-arg methods declared in this class
                    method_sigs = re.findall(
                        r'public\s+(\S+)\s+(\w+)\s*\(\s*\)\s*\{',
                        content
                    )
                    call_lines = []
                    for ret_type, mname in method_sigs:
                        if mname in ("main", "runApp"):
                            continue
                        if ret_type == "void":
                            call_lines.append(f"        {mname}();")
                        elif ret_type.endswith("[]"):
                            elem = ret_type[:-2]
                            call_lines.append(f"        {ret_type} _r_{mname} = {mname}();")
                            call_lines.append(f"        for ({elem} _item : _r_{mname}) {{ System.out.println(_item); }}")
                        else:
                            call_lines.append(f"        System.out.println({mname}());")

                    if not call_lines:
                        call_lines.append('        System.out.println("[Code compiled successfully]");')

                    body = "\n".join(call_lines)
                    injection = f'''
    public void runApp() {{
{body}
    }}

    public static void main(String[] args) {{
        new {main_class}().runApp();
    }}'''
                    content = content[:last_brace_idx] + injection + '\n' + content[last_brace_idx:]

        updated_files.append({"filename": filename, "content": content})

    return updated_files


def _fallback_check_java(files: List[Dict]) -> List[Dict]:
    errors = []
    for file in files:
        filename = file.get("filename", "Main.java")
        if not filename.lower().endswith('.java'):
            continue
        content = file.get("content", "")
        lines = content.splitlines()

        brace_stack = 0
        for i, line in enumerate(lines, start=1):
            s = line.strip()
            if not s or s.startswith('//') or s.startswith('/*') or s.startswith('*'):
                continue
            brace_stack += line.count('{')
            brace_stack -= line.count('}')
            if brace_stack < 0:
                errors.append({"file": filename, "line": i, "column": None, "severity": "error", "message": "Unmatched closing brace '}'"})
                brace_stack = 0
            if s.endswith('{') or s.endswith('}'):
                continue
            if s.startswith('package ') or s.startswith('import ') or s.startswith('@'):
                continue
            if re.match(r'(public|private|protected)\s+(class|interface|enum)\b', s):
                continue
            if re.match(r'(if|for|while|switch|else|try|catch|finally)\b', s):
                continue
            if s.endswith(';'):
                continue
            if '=' in s or s.startswith('return ') or 'System.out' in s:
                if not s.endswith(';'):
                    errors.append({"file": filename, "line": i, "column": None, "severity": "warning", "message": "Possible missing semicolon"})
            if s.count('"') % 2 == 1:
                errors.append({"file": filename, "line": i, "column": None, "severity": "error", "message": "Unclosed string literal"})
        if brace_stack > 0:
            errors.append({"file": filename, "line": len(lines) or 1, "column": None, "severity": "error", "message": "Unmatched opening brace '{'"})
    return errors


@router.post("/api/run-code")
async def run_code(request: Request):
    data = await request.json()
    
    # Handle multiple files from frontend
    files = data.get("files", [])
    main_class = data.get("main_class", "Main")
    
    # If no files array, handle single file (backward compatibility)
    if not files and "code" in data:
        code = data["code"]
        files = [{
            "filename": f"{extract_class_name(code)}.java",
            "content": code
        }]
        main_class = extract_class_name(code)
    
    # Ensure main class has a main method
    files = _ensure_main_method(files, main_class)

    # If any Java file present, use Paiza online runner (no local javac/java dependency)
    if any((file.get("filename", "").lower().endswith('.java')) for file in files):
        full_source = "\n".join(f.get("content", "") for f in files)
        try:
            resp = requests.post(
                "https://api.paiza.io/runners/create",
                data={"source_code": full_source, "language": "java", "api_key": PAIZA_API_KEY},
                timeout=10,
            )
            run_id = resp.json().get("id")
            if not run_id:
                return {"output": "", "error": "Failed to start remote runner."}

            start = __import__("datetime").datetime.now()
            while (__import__("datetime").datetime.now() - start).seconds < 30:
                result = requests.get(
                    "https://api.paiza.io/runners/get_details",
                    params={"id": run_id, "api_key": PAIZA_API_KEY},
                ).json()
                if result.get("status") == "completed":
                    stdout = (result.get("stdout") or "").strip()
                    stderr = (result.get("stderr") or "").strip()
                    build_stderr = (result.get("build_stderr") or "").strip()
                    if build_stderr or stderr:
                        return {"output": "", "error": build_stderr or stderr}
                    return {"output": stdout or "No output", "error": ""}

            return {"output": "", "error": "Execution timed out"}
        except Exception as e:
            return {"output": "", "error": f"Remote execution error: {str(e)}"}

    return {"output": "", "error": "No Java files provided."}


@router.post("/api/check-syntax")
async def check_syntax(request: Request):
    data = await request.json()
    
    # Handle multiple files
    files = data.get("files", [])
    
    # Backward compatibility for single file
    if not files and "code" in data:
        code = data["code"]
        class_name = extract_class_name(code)
        files = [{
            "filename": f"{class_name}.java",
            "content": code
        }]
    # Use fallback checker to avoid requiring a local JDK
    if any((file.get("filename", "").lower().endswith('.java')) for file in files):
        errors = _fallback_check_java(files)
        return {"errors": errors}

    return {"errors": []}
