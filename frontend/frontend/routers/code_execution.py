import subprocess
import tempfile
import os
import re
from fastapi import APIRouter, Request
from typing import List, Dict

router = APIRouter()

def extract_class_name(code: str) -> str:
    """Extract public class name from Java code"""
    match = re.search(r'public\s+class\s+([a-zA-Z0-9_]+)', code)
    return match.group(1) if match else 'Main'

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
    
    with tempfile.TemporaryDirectory() as tmp_dir:
        try:
            # Write all Java files
            java_files = []
            for file in files:
                filename = file.get("filename", "Main.java")
                content = file.get("content", "")
                
                file_path = os.path.join(tmp_dir, filename)
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(content)
                java_files.append(file_path)
            
            # Compile all files
            compile_result = subprocess.run(
                ["javac"] + java_files,
                capture_output=True,
                text=True,
                timeout=10,
                cwd=tmp_dir,
                env=os.environ.copy()
            )
            
            if compile_result.returncode != 0:
                return {
                    "output": "",
                    "error": compile_result.stderr.strip()
                }
            
            # Run the main class
            run_result = subprocess.run(
                ["java", "-cp", tmp_dir, main_class],
                capture_output=True,
                text=True,
                timeout=15,
                env=os.environ.copy()
            )
            
            return {
                "output": run_result.stdout.strip() or "No output",
                "error": run_result.stderr.strip()
            }
            
        except subprocess.TimeoutExpired:
            return {"output": "", "error": "Execution timed out (15s limit)"}
        except FileNotFoundError:
            return {"output": "", "error": "Java compiler not found. Please install JDK."}
        except Exception as e:
            return {"output": "", "error": f"Unexpected error: {str(e)}"}


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
    
    with tempfile.TemporaryDirectory() as tmp_dir:
        try:
            # Write all files
            java_files = []
            for file in files:
                filename = file.get("filename", "Main.java")
                content = file.get("content", "")
                
                file_path = os.path.join(tmp_dir, filename)
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(content)
                java_files.append((file_path, filename))
            
            # Compile all files
            compile_result = subprocess.run(
                ["javac"] + [fp for fp, _ in java_files],
                capture_output=True,
                text=True,
                timeout=10,
                cwd=tmp_dir,
                env=os.environ.copy()
            )
            
            errors = []
            if compile_result.stderr:
                stderr_lines = compile_result.stderr.splitlines()
                i = 0
                while i < len(stderr_lines):
                    line = stderr_lines[i]
                    # Match full-path or relative: /tmp/.../Main.java:3: error: msg
                    match = re.match(r'(.+\.java):(\d+):\s+(error|warning):\s+(.*)', line)
                    if match:
                        filepath = match.group(1)
                        filename = os.path.basename(filepath)
                        error_line = int(match.group(2))
                        severity = match.group(3)
                        message = match.group(4).strip()

                        # Try to find column from the caret (^) line
                        column = None
                        if i + 2 < len(stderr_lines) and '^' in stderr_lines[i + 2]:
                            column = stderr_lines[i + 2].index('^') + 1

                        errors.append({
                            "file": filename,
                            "line": error_line,
                            "column": column,
                            "severity": severity,
                            "message": message
                        })
                    i += 1

            return {"errors": errors}
            
        except subprocess.TimeoutExpired:
            return {"errors": [{"file": "general", "line": 1, "message": "Compilation timed out"}]}
        except Exception as e:
            return {"errors": [{"file": "general", "line": 1, "message": str(e)}]}
