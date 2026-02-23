import os
import json
import re
import requests
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from core.config import BASE_PATH, PAIZA_API_KEY

router = APIRouter()

class CodeRequest(BaseModel):
    code_files: dict[str, str]
    question_id: str

@router.post("/evaluate")
def evaluate(req: CodeRequest):
    qfile = os.path.join(BASE_PATH, req.question_id)

    if not os.path.exists(qfile):
        raise HTTPException(status_code=404, detail="Question not found.")

    with open(qfile, "r", encoding="utf-8") as f:
        question_data = json.load(f)

    base_class_name = question_data["baseCode"]["class"]
    user_code = req.code_files.get(base_class_name)
    if not user_code:
        raise HTTPException(status_code=400, detail="No code provided for base class.")

    # Extract ONLY the class declaration and method signatures
    # This is more aggressive - rebuild the class from scratch with only valid methods
    
    # Find the class name
    class_match = re.search(r'public\s+class\s+(\w+)', user_code)
    if not class_match:
        raise HTTPException(status_code=400, detail="No valid class declaration found.")
    
    class_name = class_match.group(1)
    
    # Extract all complete method definitions (with opening and closing braces)
    # This regex finds methods that have proper structure
    method_pattern = r'(public|private|protected)?\s+(static\s+)?([\w<>\[\]]+)\s+(\w+)\s*\([^)]*\)\s*\{(?:[^{}]|\{[^{}]*\})*\}'
    
    methods = re.findall(method_pattern, user_code, re.DOTALL)
    
    # Filter out main and runApp methods
    valid_methods = []
    for method_match in re.finditer(method_pattern, user_code, re.DOTALL):
        method_code = method_match.group(0)
        # Skip if it's main or runApp
        if 'void main' in method_code or 'void runApp' in method_code:
            continue
        valid_methods.append(method_code)
    
    # Build clean class body with only valid methods
    class_body = "\n\n    ".join(valid_methods)
    
    # Generate runApp method from solution
    run_app_lines = question_data["solution"]["methods"].get("runApp", [])
    
    if isinstance(run_app_lines, str):
        run_app_lines = [run_app_lines]
    
    run_app_method_lines = ["    public void runApp() {"]
    for line in run_app_lines:
        clean_line = line.strip()
        if clean_line:
            run_app_method_lines.append(f"        {clean_line}")
    run_app_method_lines.append("    }")
    
    run_app_method = "\n".join(run_app_method_lines)

    # Construct clean class
    full_class = f"""class {class_name} {{
    {class_body}

{run_app_method}
}}

public class Main {{
    public static void main(String[] args) {{
        new {class_name}().runApp();
    }}
}}"""

    print("=" * 80)
    print("GENERATED CODE:")
    print("=" * 80)
    print(full_class)
    print("=" * 80)

    # Submit to Paiza API
    try:
        response = requests.post(
            "https://api.paiza.io/runners/create",
            data={"source_code": full_class, "language": "java", "api_key": PAIZA_API_KEY},
            timeout=10
        )
        run_id = response.json().get("id")
        
        if not run_id:
            return {"success": False, "output": "", "error": "Failed to start runner."}

        start_time = datetime.now()
        while (datetime.now() - start_time).seconds < 30:
            result = requests.get(
                "https://api.paiza.io/runners/get_details",
                params={"id": run_id, "api_key": PAIZA_API_KEY}
            ).json()
            
            if result.get("status") == "completed":
                stdout = (result.get("stdout") or "").strip()
                stderr = (result.get("stderr") or "").strip()
                build_stderr = (result.get("build_stderr") or "").strip()
                
                if build_stderr or stderr:
                    return {
                        "success": False,
                        "output": "",
                        "error": build_stderr or stderr
                    }
                
                return {
                    "success": True,
                    "output": stdout,
                    "error": ""
                }
        
        return {"success": False, "output": "", "error": "Evaluation timed out"}
    except Exception as e:
        return {"success": False, "output": "", "error": f"Evaluation error: {str(e)}"}




@router.get("/questions")
def list_questions():
    if not os.path.exists(BASE_PATH):
        return []
    return [f for f in os.listdir(BASE_PATH) if f.endswith(".json")]

@router.get("/question/{question_id}")
def get_question(question_id: str):
    if ".." in question_id or "/" in question_id:
        raise HTTPException(status_code=400, detail="Invalid question ID.")
    
    file_path = os.path.join(BASE_PATH, question_id)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Question not found.")
    
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)

@router.get("/questions/{set_id}")
def list_questions_by_set(set_id: str):
    if ".." in set_id or "/" in set_id:
        raise HTTPException(status_code=400, detail="Invalid set ID.")
        
    set_path = os.path.join("/Users/hei/IdeaProjects/fyp/practical_tests", set_id, "questions")
    
    if not os.path.isdir(set_path):
        return []
        
    return [f for f in os.listdir(set_path) if f.endswith(".json")]
