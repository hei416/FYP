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
from core.config import PAIZA_API_KEY

try:
    from database import SessionLocal
except Exception as e:
    print(f"⚠️ Warning: database import failed: {e}")
    SessionLocal = None

# Lazy import for db_models - may not be available at startup in some environments
PracticalTestQuestion = None
try:
    from db_models import PracticalTestQuestion
except Exception as e:
    print(f"⚠️ Warning: PracticalTestQuestion import failed: {e}")

try:
    from core.topic_mapping import SUBTOPIC_TO_MAIN_TOPIC, to_main_topic, to_main_topics
except Exception as e:
    print(f"⚠️ Warning: topic_mapping import failed: {e}")
    # Provide minimal fallbacks
    SUBTOPIC_TO_MAIN_TOPIC = {}
    def to_main_topic(x): return x
    def to_main_topics(x): return [x]

router = APIRouter()

# ──────────────────────────────────────────────
# Topic-specific structural hints
# ──────────────────────────────────────────────
TOPIC_HINTS = {
    "Polymorphism": (
        "Define a non-public abstract class or interface, then 2-3 non-public subclasses that override a method. "
        "The Solution class should use these classes in its methods. "
        "Do NOT declare any class as public except Solution. "
        "Do NOT use switch/if-else to simulate polymorphism."
    ),
    "Inheritance": (
        "Define a non-public parent class and at least one non-public subclass that extends it. "
        "The Solution class should use these in its methods. "
        "Do NOT declare any class as public except Solution."
    ),
    "Interface & Lambda": (
        "Define a non-public interface with one method. "
        "Implement it using either a lambda expression or an anonymous class inside Solution. "
        "Do NOT declare any class as public except Solution."
    ),
    "Class Basics": (
        "Define a simple non-public class with private fields, a constructor, and public getter/setter methods. "
        "Use this class inside Solution. "
        "Do NOT declare any class as public except Solution."
    ),
    "Access Modifier/Static": (
        "Demonstrate at least one static method or field, and at least one private field with a public getter method. "
        "You may define a non-public helper class if needed. "
        "Do NOT declare any class as public except Solution."
    ),
    "Recursion & Revision": (
        "Solve the problem using a recursive method. Do NOT use loops (for, while). "
        "Implement recursion directly in Solution methods or in a non-public helper class."
    ),
    "Exception Handling & File IO": (
        "Use try-catch to handle at least one specific exception type (e.g., NumberFormatException, ArrayIndexOutOfBoundsException). "
        "The Solution methods should demonstrate proper exception handling."
    ),
}

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
def _row_to_dict(row) -> dict:
    """Convert database row to dictionary"""
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
            "helperClasses": row.base_helper_classes or "",
            "methods": row.base_methods,
        },
        "solution": {
            "class": row.base_class,
            "helperClasses": row.solution_helper_classes or "",
            "methods": row.solution_methods,
        },
    }

def _get_db_questions_for_topic(topic_id: str) -> List[dict]:
    """Get cached questions for a topic from the database"""
    if not SessionLocal or not PracticalTestQuestion:
        print(f"⚠️ Database not available, skipping cache lookup")
        return []
    
    try:
        db = SessionLocal()
        try:
            rows = db.query(PracticalTestQuestion).filter(
                PracticalTestQuestion.topic_id == topic_id
            ).all()
            return [_row_to_dict(r) for r in rows]
        finally:
            db.close()
    except Exception as e:
        print(f"⚠️ Error querying practical questions: {e}")
        return []

def _save_db_question(q: dict):
    """Save a new question to the database"""
    if not SessionLocal or not PracticalTestQuestion:
        print(f"⚠️ Database not available, skipping save")
        return
    
    db = None
    try:
        db = SessionLocal()
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
                base_helper_classes=q["baseCode"].get("helperClasses", ""),
                solution_methods=q["solution"]["methods"],
                solution_helper_classes=q["solution"].get("helperClasses", ""),
            ))
            db.commit()
            print(f"✅ Saved practical test question {q['id']} to DB")
    except Exception as e:
        if db:
            db.rollback()
        print(f"🔴 DB save error: {e}")
        traceback.print_exc()
    finally:
        if db:
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

    # Conditionally inject topic-specific hint
    topic_hint = TOPIC_HINTS.get(topic, "")
    hint_block = f"\nTOPIC HINT: {topic_hint}" if topic_hint else ""

    id_val = f"pt_{int(time.time())}_{random.randint(1000, 9999)}"
    class_name = "Solution"

    prompt = f"""You are a Java instructor. Create a simple, beginner-friendly coding exercise for the topic: "{topic}".
{exclusion}{hint_block}

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
      {{"name": "actualMethodName", "description": "One sentence: what to implement."}}
    ],
    "expectedOutput": ["line1", "line2"]
  }},
  "baseCode": {{
    "class": "{class_name}",
    "helperClasses": "",
    "methods": {{
      "actualMethodName": "public ReturnType actualMethodName() {{}}"
    }}
  }},
  "solution": {{
    "class": "{class_name}",
    "helperClasses": "",
    "methods": {{
      "actualMethodName": ["// implementation lines that solve the problem"],
      "runApp": ["actualMethodName();", "System.out.println(result);"]
    }}
  }}
}}

CRITICAL RULES - READ CAREFULLY:
- REPLACE "actualMethodName" with a REAL, DESCRIPTIVE METHOD NAME
- Method signature: NO PARAMETERS. Example: public String getValue() not public String getValue(String param)
- In runApp, call methods with NO ARGUMENTS: result = actualMethodName() not actualMethodName(param)
- ONLY call methods that exist in baseCode.methods with the SAME signature
- runApp must print EXACTLY the lines in expectedOutput
- Do NOT include runApp in question.methods or baseCode.methods
- For Polymorphism/Inheritance: place helper classes in baseCode.helperClasses and solution.helperClasses
- helperClasses can be empty for simple questions
- ALL method stubs in baseCode.methods MUST have proper return statements (return null, return 0, return false, etc)
- Ensure ALL baseCode.methods stubs are syntactically correct Java code
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
    # Validate response has all required keys
    if not all(k in result for k in ("question", "baseCode", "solution")):
        raise ValueError("Missing required keys in LLM response")
    
    # Validate that methods called in runApp exist in baseCode.methods
    defined_methods = set(result.get("baseCode", {}).get("methods", {}).keys())
    defined_methods.discard("runApp")  # runApp is not a student-implemented method
    
    run_app_code = "\n".join(result.get("solution", {}).get("methods", {}).get("runApp", []))
    # Extract method calls (simple pattern: word followed by parentheses)
    called_methods = set(re.findall(r'(\w+)\s*\(', run_app_code))
    
    # Filter out Java/system keywords and methods
    keywords_to_discard = {"System", "for", "new", "this", "if", "while", "switch", "catch", 
                           "println", "out", "return", "parseInt", "toString", "length"}
    called_methods = called_methods - keywords_to_discard
    
    undefined_methods = called_methods - defined_methods
    if undefined_methods:
        raise ValueError(f"runApp calls undefined methods: {undefined_methods}. Defined methods: {defined_methods}")
    
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
@router.post("/generate")
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
def _run_java_via_paiza(class_name: str, class_body: str, run_app_method: str, helper_classes: str = "") -> dict:
    # Prepend helper classes (abstract classes, interfaces, etc.)
    helper_block = f"{helper_classes}\n\n" if helper_classes.strip() else ""

    # Indent run_app_method to place it inside the class body
    indented_run_app = "\n".join("    " + line if line.strip() else line for line in run_app_method.split("\n"))

    # FIX: Use a single public class with main() merged in.
    # Previously this produced two top-level classes (class Solution + public class Main)
    # which caused Paiza to name the file Main.java, triggering:
    # "class Solution is public, should be declared in a file named Solution.java"
    full_class = f"""{helper_block}public class {class_name} {{
    {class_body}

{indented_run_app}

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


def _extract_helper_classes(user_code: str) -> str:
    """Extract all non-public top-level class definitions (everything before public class Solution)."""
    match = re.search(r'public\s+class\s+Solution\s*\{', user_code)
    if not match:
        return ""
    # Everything before 'public class Solution' is helper classes
    return user_code[:match.start()].strip()


def _extract_student_methods(user_code: str):
    """Extract student code, handling nested classes (for Polymorphism/Inheritance)."""
    # Find the public class declaration
    class_match = re.search(r'public\s+class\s+(\w+)', user_code)
    if not class_match:
        raise HTTPException(status_code=400, detail="No valid class declaration found.")
    class_name = class_match.group(1)

    # Find the opening brace of the public class (NOT the first { in the file)
    start_idx = user_code.find('{', class_match.end())
    if start_idx == -1:
        raise HTTPException(status_code=400, detail="No class body found.")
    
    # Count braces to find the matching closing brace
    brace_count = 0
    end_idx = start_idx
    for i in range(start_idx, len(user_code)):
        if user_code[i] == '{':
            brace_count += 1
        elif user_code[i] == '}':
            brace_count -= 1
            if brace_count == 0:
                end_idx = i
                break
    
    class_body = user_code[start_idx + 1:end_idx].strip()

    # Remove main() method if present
    class_body = re.sub(r'public\s+static\s+void\s+main\s*\([^)]*\)\s*\{[\s\S]*?\n\s*\}', '', class_body)
    
    # Remove runApp() method if present
    class_body = re.sub(r'public\s+void\s+runApp\s*\(\s*\)\s*\{[\s\S]*?\n\s*\}', '', class_body)
    
    # Clean up any extra blank lines
    class_body = re.sub(r'\n\s*\n\s*\n+', '\n\n', class_body).strip()

    return class_name, class_body


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


def _build_smart_run_app(base_methods: dict) -> str:
    """Generate a runApp() that directly calls each known method and prints results."""
    lines = ["    public void runApp() {"]
    for method_name, signature in base_methods.items():
        if method_name == "runApp":
            continue
        # Parse return type from signature: e.g. "public String[] getAnimalSound() {}"
        m = re.search(r'public\s+(\S+)\s+\w+\s*\(', signature)
        if not m:
            continue
        return_type = m.group(1)

        if return_type == "void":
            lines.append(f"        {method_name}();")
        elif return_type.endswith("[]"):
            elem = return_type[:-2]  # strip []
            lines.append(f"        {return_type} _r_{method_name} = {method_name}();")
            lines.append(f"        for ({elem} _item : _r_{method_name}) {{")
            lines.append(f"            System.out.println(_item);")
            lines.append(f"        }}")
        else:
            lines.append(f"        System.out.println({method_name}());")

    lines.append("    }")
    return "\n".join(lines)


@router.post("/evaluate-ai")
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
    helper_classes = _extract_helper_classes(user_code)
    run_app_method = _build_smart_run_app(row.base_methods)
    return _run_java_via_paiza(class_name, class_body, run_app_method, helper_classes)


# ──────────────────────────────────────────────
# All questions are now AI-generated and stored in DB
# Static file-based endpoints have been removed
# ──────────────────────────────────────────────
