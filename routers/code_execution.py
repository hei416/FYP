import subprocess
import tempfile
import os
import re
from fastapi import APIRouter, Request
from core.utils import extract_class_name

router = APIRouter()

@router.post("/api/run-code")
async def run_code(request: Request):
    data = await request.json()
    code = data.get("code", "")
    class_name = extract_class_name(code)

    with tempfile.TemporaryDirectory() as tmp_dir:
        java_file = os.path.join(tmp_dir, f"{class_name}.java")
        
        try:
            # Write and compile
            with open(java_file, "w") as f:
                f.write(code)
            
            compile_result = subprocess.run(
                ["javac", java_file],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if compile_result.returncode != 0:
                return {"output": "", "error": compile_result.stderr.strip()}
            
            # Run compiled code
            run_result = subprocess.run(
                ["java", "-cp", tmp_dir, class_name],
                capture_output=True,
                text=True,
                timeout=15
            )
            
            return {
                "output": run_result.stdout.strip() or "No output",
                "error": run_result.stderr.strip()
            }
        except subprocess.TimeoutExpired:
            return {"output": "", "error": "Execution timed out"}
        except Exception as e:
            return {"output": "", "error": str(e)}

@router.post("/api/check-syntax")
async def check_syntax(request: Request):
    data = await request.json()
    code = data.get("code", "")
    class_name = extract_class_name(code)

    with tempfile.TemporaryDirectory() as tmp:
        file_path = os.path.join(tmp, f"{class_name}.java")
        with open(file_path, "w") as f:
            f.write(code)

        compile = subprocess.run(["javac", file_path], capture_output=True, text=True, timeout=10)
        errors = []
        if compile.stderr:
            for line in compile.stderr.splitlines():
                m = re.match(rf"{class_name}\.java:(\d+):\s+(error:.*?)$", line)
                if m:
                    errors.append({"line": int(m.group(1)), "message": m.group(2).strip()})

        return {"errors": errors}
