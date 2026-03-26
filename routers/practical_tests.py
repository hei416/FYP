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

PracticalTestQuestion = None
try:
    from db_models import PracticalTestQuestion
except Exception as e:
    print(f"⚠️ Warning: PracticalTestQuestion import failed: {e}")

try:
    from core.topic_mapping import SUBTOPIC_TO_MAIN_TOPIC, to_main_topic, to_main_topics
except Exception as e:
    print(f"⚠️ Warning: topic_mapping import failed: {e}")
    SUBTOPIC_TO_MAIN_TOPIC = {}

    def to_main_topic(x):
        return x

    def to_main_topics(x):
        return [x]

router = APIRouter()

TOPIC_HINTS = {
    "Polymorphism": (
        "Define a non-public abstract class or interface, then 2-3 non-public subclasses that override a method. "
        "The Main class should use these classes in its methods. "
        "Do NOT declare any class as public except Main. "
        "Do NOT use switch/if-else to simulate polymorphism."
    ),
    "Inheritance": (
        "Define a non-public parent class and at least one non-public subclass that extends it. "
        "The Main class should use these in its methods. "
        "Do NOT declare any class as public except Main."
    ),
    "Interface & Lambda": (
        "Define a non-public interface with one method. "
        "Implement it using either a lambda expression or an anonymous class inside Main. "
        "Do NOT declare any class as public except Main."
    ),
    "Class Basics": (
        "Define a simple non-public class with private fields, a constructor, and public getter/setter methods. "
        "Use this class inside Main. "
        "Do NOT declare any class as public except Main."
    ),
    "Access Modifier/Static": (
        "Demonstrate at least one static method or field, and at least one private field with a public getter method. "
        "You may define a non-public helper class if needed. "
        "Do NOT declare any class as public except Main."
    ),
    "Recursion & Revision": (
        "Solve the problem using a recursive method. Do NOT use loops (for, while). "
        "Implement recursion directly in Main methods or in a non-public helper class."
    ),
    "Exception Handling & File IO": (
        "Use try-catch to handle at least one specific exception type (e.g., NumberFormatException, ArrayIndexOutOfBoundsException). "
        "The Main methods should demonstrate proper exception handling."
    ),
}


def _get_paiza_key() -> str:
    """Always read PAIZA_API_KEY fresh from env so .env changes take effect."""
    return os.environ.get("PAIZA_API_KEY") or PAIZA_API_KEY or "guest"


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
            cfg["url"],
            headers=cfg["headers"],
            json={
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "response_format": {"type": "json_object"},
            },
        )
        resp.raise_for_status()
        raw = resp.json()["choices"][0]["message"]["content"]
        raw = raw.replace("```json", "").replace("```", "").strip()
        return json.loads(raw)


def _row_to_dict(row) -> dict:
    return {
        "id": row.id,
        "topic_id": row.topic_id,
        "topics": getattr(row, "topics", None) or [row.topic_id],
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


def _get_db_questions_for_topics(topics: List[str]) -> List[dict]:
    db = SessionLocal()
    try:
        if len(topics) == 1:
            rows = db.query(PracticalTestQuestion).filter(
                PracticalTestQuestion.topic_id == topics[0]).all()
        else:
            all_rows = db.query(PracticalTestQuestion).filter(
                PracticalTestQuestion.topics.isnot(None)).all()
            rows = [r for r in all_rows if all(t in (r.topics or []) for t in topics)]
        return [_row_to_dict(r) for r in rows]
    finally:
        db.close()


def _save_db_question(q: dict):
    if not SessionLocal or not PracticalTestQuestion:
        print("⚠️ Database not available, skipping save")
        return

    db = None
    try:
        db = SessionLocal()
        exists = db.query(PracticalTestQuestion).filter(
            PracticalTestQuestion.id == q["id"]
        ).first()
        if not exists:
            db.add(
                PracticalTestQuestion(
                    id=q["id"],
                    topic_id=q["topic_id"],
                    topics=q.get("topics", [q["topic_id"]]),
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
                )
            )
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


async def _generate_practical_question(topic: str, existing_titles: List[str]) -> dict:
    exclusion = ""
    if existing_titles:
        exclusion = "\n\nDo NOT repeat any of these existing question titles:\n" + "\n".join(
            f"- {t}" for t in existing_titles[-10:]
        )

        # Support multi-topic prompts. `topic` may contain multiple main topics joined by " and ".
        topics_list = [t.strip() for t in topic.split(" and ")]
        is_multi = len(topics_list) > 1

        if is_multi:
                hints = [TOPIC_HINTS[t] for t in topics_list if t in TOPIC_HINTS]
                hint_block = (
                        "\nTOPIC HINTS — your solution MUST demonstrate ALL of the following:\n"
                        + "\n".join(f"- {h}" for h in hints)
                ) if hints else ""
                complexity_block = """COMPLEXITY:
- 2 to 3 methods
- Each method should relate to a different topic listed above
- Use only basic Java but DO demonstrate all required concepts
- Expected output should be 3–6 lines"""
        else:
                topic_hint = TOPIC_HINTS.get(topic, "")
                hint_block = f"\nTOPIC HINT: {topic_hint}" if topic_hint else ""
                complexity_block = """KEEP IT SIMPLE:
- 1 to 2 methods only
- A single clear sentence describing what each method does
- Use only basic Java (int, String, arrays, loops) — no generics, no complex data structures
- Expected output should be 3–6 lines at most
- No puzzles, no grids, no complex scenarios"""

        id_val = f"pt_{int(time.time())}_{random.randint(1000, 9999)}"
        class_name = "Main"

        prompt = f"""You are a Java instructor. Create a beginner-friendly coding exercise covering: "{topic}".
{exclusion}{hint_block}

{complexity_block}

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

    if not all(k in result for k in ("question", "baseCode", "solution")):
        raise ValueError("Missing required keys in LLM response")

    defined_methods = set(result.get("baseCode", {}).get("methods", {}).keys())
    defined_methods.discard("runApp")

    run_app_code = "\n".join(result.get("solution", {}).get("methods", {}).get("runApp", []))
    called_methods = set(re.findall(r'(\w+)\s*\(', run_app_code))

    keywords_to_discard = {
        "System", "for", "new", "this", "if", "while", "switch", "catch",
        "println", "out", "return", "parseInt", "toString", "length"
    }
    called_methods = called_methods - keywords_to_discard

    undefined_methods = called_methods - defined_methods
    if undefined_methods:
        raise ValueError(
            f"runApp calls undefined methods: {undefined_methods}. Defined methods: {defined_methods}"
        )

    return result


class CodeRequest(BaseModel):
    code_files: dict[str, str]
    question_id: str


class AiCodeRequest(BaseModel):
    code_files: dict[str, str]
    question_db_id: str
    question_data: Optional[dict] = None  # fallback for questions not yet in DB


class PracticalGenerateRequest(BaseModel):
    topic: str
    topics: Optional[List[str]] = None
    force_new: bool = False


@router.post("/generate")
async def generate_practical_test(req: PracticalGenerateRequest):
    # Support multi-topic generation: prefer `topics` array, fallback to single `topic`.
    topics = req.topics if req.topics and len(req.topics) > 0 else [req.topic]
    # Map subtopics to main topics where applicable
    main_topics = to_main_topics(topics)
    # Enforce a server-side cap for topics per generated question
    MAX_TOPICS_PER_QUESTION = 3
    if len(main_topics) > MAX_TOPICS_PER_QUESTION:
        main_topics = random.sample(main_topics, MAX_TOPICS_PER_QUESTION)
    topic_str = " and ".join(main_topics)
    print(f"📥 Practical test generate: topics={topic_str}, force_new={req.force_new}")

    # Check DB cache across the full topics list (fast path)
    if not req.force_new:
        cached = _get_db_questions_for_topics(main_topics)
        if cached:
            return {"question_data": random.choice(cached), "source": "database"}

    try:
        # Pass the combined topic string to the generator so the prompt can reference all topics
        new_q = await _generate_practical_question(topic_str, [])
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")

    # Tag with all topics and persist as a record (primary topic is first)
    new_q["topics"] = main_topics
    new_q["topic_id"] = main_topics[0]
    _save_db_question(new_q)
    return {"question_data": new_q, "source": "ai_generated", "topics": main_topics}


def _run_java_via_paiza(class_name: str, class_body: str, run_app_method: str, helper_classes: str = "") -> dict:
    helper_block = f"{helper_classes}\n\n" if helper_classes.strip() else ""
    indented_run_app = "\n".join(
        "    " + line if line.strip() else line
        for line in run_app_method.split("\n")
    )

    full_class = f"""{helper_block}public class Main {{
    {class_body}

{indented_run_app}

    public static void main(String[] args) {{
        new Main().runApp();
    }}
}}"""

    print("=" * 80)
    print("GENERATED CODE:")
    print("=" * 80)
    print(full_class)
    print("=" * 80)

    api_key = _get_paiza_key()
    try:
        response = requests.post(
            "https://api.paiza.io/runners/create",
            data={"source_code": full_class, "language": "java", "api_key": api_key},
            timeout=30,
        )
        run_id = response.json().get("id")
        if not run_id:
            err = response.json().get("error", "Failed to start runner.")
            print(f"🔴 Paiza create failed: {response.status_code} {response.text}")
            return {"success": False, "output": "", "error": err}

        start_time = datetime.now()
        while (datetime.now() - start_time).seconds < 30:
            result = requests.get(
                "https://api.paiza.io/runners/get_details",
                params={"id": run_id, "api_key": api_key},
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
    match = re.search(r'public\s+class\s+\w+\s*\{', user_code)
    if not match:
        return ""
    return user_code[:match.start()].strip()


def _extract_student_methods(user_code: str):
    class_match = re.search(r'public\s+class\s+(\w+)', user_code)
    if not class_match:
        raise HTTPException(status_code=400, detail="No valid class declaration found.")

    class_name = class_match.group(1)

    start_idx = user_code.find("{", class_match.end())
    if start_idx == -1:
        raise HTTPException(status_code=400, detail="No class body found.")

    brace_count = 0
    end_idx = start_idx
    for i in range(start_idx, len(user_code)):
        if user_code[i] == "{":
            brace_count += 1
        elif user_code[i] == "}":
            brace_count -= 1
            if brace_count == 0:
                end_idx = i
                break

    class_body = user_code[start_idx + 1:end_idx].strip()
    class_body = re.sub(
        r'public\s+static\s+void\s+main\s*\([^)]*\)\s*\{[\s\S]*?\n\s*\}',
        '',
        class_body,
    )
    class_body = re.sub(
        r'public\s+void\s+runApp\s*\(\s*\)\s*\{[\s\S]*?\n\s*\}',
        '',
        class_body,
    )
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
    lines = ["    public void runApp() {"]
    for method_name, signature in base_methods.items():
        if method_name == "runApp":
            continue

        m = re.search(r'public\s+(\S+)\s+\w+\s*\(', signature)
        if not m:
            continue
        return_type = m.group(1)

        if return_type == "void":
            lines.append(f"        {method_name}();")
        elif return_type.endswith("[]"):
            elem = return_type[:-2]
            lines.append(f"        {return_type} _r_{method_name} = {method_name}();")
            lines.append(f"        if (_r_{method_name} != null) {{")
            lines.append(f"            for ({elem} _item : _r_{method_name}) {{")
            lines.append("                System.out.println(_item);")
            lines.append("            }")
            lines.append("        }")
        else:
            lines.append(f"        System.out.println({method_name}());")

    lines.append("    }")
    return "\n".join(lines)


@router.post("/evaluate-ai")
def evaluate_ai(req: AiCodeRequest):
    row = None
    if SessionLocal and PracticalTestQuestion:
        db = SessionLocal()
        try:
            row = db.query(PracticalTestQuestion).filter(
                PracticalTestQuestion.id == req.question_db_id).first()
        finally:
            db.close()

    if not row:
        if not req.question_data:
            raise HTTPException(status_code=404, detail="Question not found.")
        class SimpleRow:
            base_class = req.question_data.get("baseCode", {}).get("class", "Main")
            base_methods = req.question_data.get("baseCode", {}).get("methods", {})
        row = SimpleRow()

    user_code = (
        req.code_files.get(row.base_class)
        or req.code_files.get("Solution")
        or req.code_files.get("Main")
    )
    if not user_code:
        raise HTTPException(
            status_code=400,
            detail=f"No code provided for class '{row.base_class}' (tried '{row.base_class}', 'Solution', 'Main').",
        )

    class_name, class_body = _extract_student_methods(user_code)
    helper_classes = _extract_helper_classes(user_code)
    run_app_method = _build_smart_run_app(row.base_methods)
    return _run_java_via_paiza(class_name, class_body, run_app_method, helper_classes)
