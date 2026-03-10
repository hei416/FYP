import os
import json
import re
import time
import random
import traceback
import requests
import httpx
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from core.config import BASE_PATH, PAIZA_API_KEY
from database import SessionLocal
from db_models import PracticalTestQuestion
from core.topic_mapping import SUBTOPIC_TO_MAIN_TOPIC, to_main_topic, to_main_topics

router = APIRouter()

# ──────────────────────────────────────────────
# LLM helper (mirrors rag.py's call_llm_json)
# ──────────────────────────────────────────────
def _get_api_config():
    from core.config import API_KEY, BASE_URL, FAISS_MODEL_NAME, FAISS_API_VERSION
    return {
        "url": f"{BASE_URL}/deployments/{FAISS_MODEL_NAME}/chat/completions?api-version={FAISS_API_VERSION}",
        "headers": {"Content-Type": "application/json", "api-key": API_KEY},
    }

async def _call_llm_json(messages, temperature=0.5, max_tokens=2500, timeout=120):
    cfg = _get_api_config()
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(
            cfg["url"], headers=cfg["headers"],
            json={"messages": messages, "temperature": temperature,
                  "max_tokens": max_tokens, "response_format": {"type": "json_object"}},
        )
        resp.raise_for_status()
        raw = resp.json()["choices"][0]["message"]["content"]
        raw = raw.replace("```json", "").replace("```", "").strip()
        return json.loads(raw)

# ──────────────────────────────────────────────
# DB helpers for PracticalTestQuestion
# ──────────────────────────────────────────────
def _row_to_dict(row: PracticalTestQuestion) -> dict:
    return {
        "id": row.id,
        "topic_id": row.topic_id,
        "question": {
            "title": row.title,
            "description": row.description,
            "note": row.note,
            "methods": row.methods,
            "expectedOutput": row.expected_output,
        },
        "baseCode": {
            "class": row.base_class,
            "methods": row.base_methods,
        },
        "solution": {
            "class": row.base_class,
            "methods": row.solution_methods,
        },
    }

def _get_db_questions_for_topic(topic_id: str) -> List[dict]:
    db = SessionLocal()
    try:
        rows = db.query(PracticalTestQuestion).filter(
            PracticalTestQuestion.topic_id == topic_id
        ).all()
        return [_row_to_dict(r) for r in rows]
    finally:
        db.close()

def _save_db_question(q: dict):
    db = SessionLocal()
    try:
        exists = db.query(PracticalTestQuestion).filter(PracticalTestQuestion.id == q["id"]).first()
        if not exists:
            db.add(PracticalTestQuestion(
                id=q["id"],
                topic_id=q["topic_id"],
                title=q["question"]["title"],
                description=q["question"]["description"],
                note=q["question"].get("note"),
                methods=q["question"]["methods"],
                expected_output=q["question"]["expectedOutput"],
                base_class=q["baseCode"]["class"],
                base_methods=q["baseCode"]["methods"],
                solution_methods=q["solution"]["methods"],
            ))
            db.commit()
            print(f"✅ Saved practical test question {q['id']} to DB")
    except Exception as e:
        db.rollback()
        print(f"🔴 DB save error: {e}")
        traceback.print_exc()
    finally:
        db.close()

# ──────────────────────────────────────────────
# AI generation
# ──────────────────────────────────────────────
async def _generate_practical_question(topic: str, existing_titles: List[str]) -> dict:
    """Ask the LLM to generate one complete Java coding question for the given topic."""
    exclusion = ""
    if existing_titles:
        exclusion = "\n\nDo NOT repeat any of these existing question titles:\n" + "\n".join(
            f"- {t}" for t in existing_titles[-10:]
        )

    id_val = f"pt_{int(time.time())}_{random.randint(1000, 9999)}"
    class_name = "Solution"

    prompt = f"""You are a Java instructor. Create a simple, beginner-friendly coding exercise for the topic: "{topic}".
{exclusion}

KEEP IT SIMPLE:
- 1 to 2 methods only
- A single clear sentence describing what each method does
- Use only basic Java (int, String, arrays, loops) — no generics, no complex data structures
- Expected output should be 3–6 lines at most
- No puzzles, no grids, no complex scenarios

Return a JSON object with this EXACT schema:

{{
  "id": "{id_val}",
  "topic_id": "{topic}",
  "question": {{
    "title": "Short title (5 words max)",
    "description": "One or two plain sentences describing the task.",
    "note": "",
    "methods": [
      {{"name": "methodName", "description": "One sentence: what to implement."}}
    ],
    "expectedOutput": ["line1", "line2"]
  }},
  "baseCode": {{
    "class": "{class_name}",
    "methods": {{
      "methodName": "public ReturnType methodName(ParamType param) {{}}"
    }}
  }},
  "solution": {{
    "class": "{class_name}",
    "methods": {{
      "methodName": ["// implementation lines"],
      "runApp": ["// calls each method and prints the expected output"]
    }}
  }}
}}

RULES:
- Every method in "question.methods" must have a stub in "baseCode.methods" and full code in "solution.methods"
- "solution.methods.runApp" must print EXACTLY the lines in "question.expectedOutput"
- Do NOT include main() anywhere
- Do NOT include "runApp" in "question.methods" or "baseCode.methods"
- Return ONLY valid JSON, no markdown"""

    result = await _call_llm_json(
        messages=[
            {"role": "system", "content": "You are an expert Java instructor. Respond with valid JSON only."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.6,
        max_tokens=2500,
        timeout=120,
    )
    # Basic validation
    assert "question" in result and "baseCode" in result and "solution" in result, \
        "Missing required keys in LLM response"
    return result

# ──────────────────────────────────────────────
# Request/response models
# ──────────────────────────────────────────────
class CodeRequest(BaseModel):
    code_files: dict[str, str]
    question_id: str

class AiCodeRequest(BaseModel):
    """Evaluate student code against an AI-generated question stored in the DB."""
    code_files: dict[str, str]
    question_db_id: str          # the 'id' field from the DB row

class PracticalGenerateRequest(BaseModel):
    topic: str                  # main topic name or subtopic id
    force_new: bool = False     # if True, always generate fresh from AI


# ──────────────────────────────────────────────
# AI GENERATE endpoint
# ──────────────────────────────────────────────
@router.post("/api/practical-tests/generate")
async def generate_practical_test(req: PracticalGenerateRequest):
    """
    Generate (or serve from DB) a coding exercise for the given topic.
    - If force_new=False and DB already has questions for this topic, return a random cached one.
    - Otherwise call the AI to create a new question, save it, then return it.
    """
    main_topic = to_main_topic(req.topic)
    print(f"📥 Practical test generate: topic={main_topic}, force_new={req.force_new}")

    # Serve from cache unless force_new
    if not req.force_new:
        cached = _get_db_questions_for_topic(main_topic)
        if cached:
            chosen = random.choice(cached)
            print(f"✅ Serving cached practical question {chosen['id']} for topic '{main_topic}'")
            return {"question_data": chosen, "source": "database", "topic": main_topic}

    # Generate from AI
    existing = _get_db_questions_for_topic(main_topic)
    existing_titles = [q["question"]["title"] for q in existing]

    try:
        new_q = await _generate_practical_question(main_topic, existing_titles)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")

    _save_db_question(new_q)
    return {"question_data": new_q, "source": "ai_generated", "topic": main_topic}


# ──────────────────────────────────────────────
# EVALUATE  (file-based questions – unchanged)
# ──────────────────────────────────────────────
def _run_java_via_paiza(class_name: str, class_body: str, run_app_method: str) -> dict:
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

    try:
        response = requests.post(
            "https://api.paiza.io/runners/create",
            data={"source_code": full_class, "language": "java", "api_key": PAIZA_API_KEY},
            timeout=10,
        )
        run_id = response.json().get("id")
        if not run_id:
            return {"success": False, "output": "", "error": "Failed to start runner."}

        start_time = datetime.now()
        while (datetime.now() - start_time).seconds < 30:
            result = requests.get(
                "https://api.paiza.io/runners/get_details",
                params={"id": run_id, "api_key": PAIZA_API_KEY},
            ).json()
            if result.get("status") == "completed":
                stdout = (result.get("stdout") or "").strip()
                stderr = (result.get("stderr") or "").strip()
                build_stderr = (result.get("build_stderr") or "").strip()
                if build_stderr or stderr:
                    return {"success": False, "output": "", "error": build_stderr or stderr}
                return {"success": True, "output": stdout, "error": ""}

        return {"success": False, "output": "", "error": "Evaluation timed out"}
    except Exception as e:
        return {"success": False, "output": "", "error": f"Evaluation error: {str(e)}"}


def _extract_student_methods(user_code: str):
    """Extract student-implemented methods, skipping main/runApp."""
    class_match = re.search(r'public\s+class\s+(\w+)', user_code)
    if not class_match:
        raise HTTPException(status_code=400, detail="No valid class declaration found.")
    class_name = class_match.group(1)

    method_pattern = r'(public|private|protected)?\s+(static\s+)?([\w<>\[\]]+)\s+(\w+)\s*\([^)]*\)\s*\{(?:[^{}]|\{[^{}]*\})*\}'
    valid_methods = []
    for m in re.finditer(method_pattern, user_code, re.DOTALL):
        code = m.group(0)
        if 'void main' in code or 'void runApp' in code:
            continue
        valid_methods.append(code)

    return class_name, "\n\n    ".join(valid_methods)


def _build_run_app_method(run_app_lines) -> str:
    if isinstance(run_app_lines, str):
        run_app_lines = [run_app_lines]
    lines = ["    public void runApp() {"]
    for line in run_app_lines:
        clean = line.strip()
        if clean:
            lines.append(f"        {clean}")
    lines.append("    }")
    return "\n".join(lines)


@router.post("/evaluate")
def evaluate(req: CodeRequest):
    """Evaluate student code against a file-based question."""
    qfile = os.path.join(BASE_PATH, req.question_id)
    if not os.path.exists(qfile):
        raise HTTPException(status_code=404, detail="Question not found.")
    with open(qfile, "r", encoding="utf-8") as f:
        question_data = json.load(f)

    base_class_name = question_data["baseCode"]["class"]
    user_code = req.code_files.get(base_class_name)
    if not user_code:
        raise HTTPException(status_code=400, detail="No code provided for base class.")

    class_name, class_body = _extract_student_methods(user_code)
    run_app_method = _build_run_app_method(question_data["solution"]["methods"].get("runApp", []))
    return _run_java_via_paiza(class_name, class_body, run_app_method)


@router.post("/api/practical-tests/evaluate-ai")
def evaluate_ai(req: AiCodeRequest):
    """Evaluate student code against an AI-generated question stored in DB."""
    db = SessionLocal()
    try:
        row = db.query(PracticalTestQuestion).filter(PracticalTestQuestion.id == req.question_db_id).first()
    finally:
        db.close()

    if not row:
        raise HTTPException(status_code=404, detail="Question not found in database.")

    user_code = req.code_files.get(row.base_class)
    if not user_code:
        raise HTTPException(status_code=400, detail=f"No code provided for class '{row.base_class}'.")

    class_name, class_body = _extract_student_methods(user_code)
    run_app_method = _build_run_app_method(row.solution_methods.get("runApp", []))
    return _run_java_via_paiza(class_name, class_body, run_app_method)


# ──────────────────────────────────────────────
# Static file-based question endpoints (unchanged)
# ──────────────────────────────────────────────
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
