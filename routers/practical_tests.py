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

    # Generate runApp() method from solution lines
    run_app_lines = question_data["solution"].get("runApp", [])
    run_app_method = (
        "public void runApp() {\n"
        + "\n".join(f"    {line}" for line in run_app_lines)
        + "\n}")

    # Extract content inside the user's class definition
    class_body_match = re.search(r'public\s+class\s+\w+\s*\{(.*)\}', user_code, re.DOTALL)
    user_code_body = class_body_match.group(1).strip() if class_body_match else user_code

    # Remove any existing runApp method
    user_code_body = re.sub(r'public\s+void\s+runApp\s*\(\s*\)\s*\{.*?\}', '', user_code_body, flags=re.DOTALL)

    # Construct classes
    user_class_code = f"class {base_class_name} {{ {user_code_body}\n\n{run_app_method}\n}}"
    main_class_code = f"public class Main {{    public static void main(String[] args) {{        new {base_class_name}().runApp();    }}}}"
    full_source = user_class_code + "\n\n" + main_class_code

    # Submit to Paiza API
    try:
        response = requests.post(
            "https://api.paiza.io/runners/create",
            data={"source_code": full_source, "language": "java", "api_key": PAIZA_API_KEY},
            timeout=10
        )
        run_id = response.json().get("id")
        
        if not run_id:
            return {"output": "Failed to start runner."}

        # Wait for completion
        start_time = datetime.now()
        while (datetime.now() - start_time).seconds < 30:  # 30s timeout
            result = requests.get(
                "https://api.paiza.io/runners/get_details",
                params={"id": run_id, "api_key": PAIZA_API_KEY}
            ).json()
            
            if result.get("status") == "completed":
                return {
                    "output": result.get("stdout", "") or 
                             result.get("stderr", "") or 
                             result.get("build_stderr", "")
                }
        
        return {"output": "Evaluation timed out"}
    except Exception as e:
        return {"output": f"Evaluation error: {str(e)}"}

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
