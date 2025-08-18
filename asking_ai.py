import hashlib
import subprocess
import fitz  # PyMuPDF
from fastapi import FastAPI, HTTPException, Path, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, PlainTextResponse, JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from database import SessionLocal
from models import RAGCache
import requests
import os
import json
import traceback
import re
import tempfile, subprocess
from urllib.parse import unquote

API_KEY = os.getenv("GENAI_API_KEY", "your-fallback")
PAIZA_API_KEY = os.getenv("PAIZA_API_KEY", "guest")
LESSON_DIR = "/Users/hei/IdeaProjects/fyp/lessons_raw"
PDF_DIR = "/Users/hei/IdeaProjects/fyp/frontend/Lecture Notes-20250622"
JSON_PATH = "/Users/hei/IdeaProjects/fyp/oracle_java_tutorials_clean.json"
BASE_URL = "https://genai.hkbu.edu.hk/general/rest"
BASE_PATH = "/Users/hei/IdeaProjects/fyp/practical_tests/set1/questions"

MODEL_API_VERSIONS = {
    "gpt-4-o-mini": "2024-10-21",
    "gpt-4-o": "2024-10-21",
    "gemini-1.5-pro": "002",
    "gemini-1.5-flash": "002",
    "deepseek-r1": "2024-05-01-preview",
}
MODEL_ENDPOINTS = {
    "gpt": "/chat/completions",
    "gemini": "/generate_content",
    "deepseek": "/chat/completions",
}
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
def get_model_type(model: str) -> str:
    if model.startswith("gpt") or model.startswith("o1"):
        return "gpt"
    elif model.startswith("gemini"):
        return "gemini"
    return "deepseek"

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

with open(JSON_PATH, "r", encoding="utf-8") as f:
    oracle_json = json.load(f)

class ExplainRequest(BaseModel):
    user_input: str
    code_snippet: str = ""
    history: List[Dict[str, Any]] = []

def call_model(deployment: str, messages: List[Dict[str, str]]) -> str:
    api_version = MODEL_API_VERSIONS.get(deployment)
    model_type = get_model_type(deployment)
    endpoint = MODEL_ENDPOINTS.get(model_type)
    url = f"{BASE_URL}/deployments/{deployment}{endpoint}?api-version={api_version}"
    headers = {"Content-Type": "application/json", "api-key": API_KEY}

    if model_type in {"gpt", "deepseek"}:
        payload = {"messages": messages}
    elif model_type == "gemini":
        contents = [{"role": m["role"], "parts": [{"text": m["content"]}]} for m in messages]
        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": 0.7,
                "candidateCount": 1,
                "topP": 0.95,
                "topK": 40
            },
            "stream": False
        }

    response = requests.post(url, json=payload, headers=headers)
    if not response.ok:
        print(f"[ERROR] Model {deployment} failed: {response.status_code} {response.text}")
    response.raise_for_status()
    data = response.json()
    if model_type in {"gpt", "deepseek"}:
        return data["choices"][0]["message"]["content"]
    if model_type == "gemini":
        return data["candidates"][0]["content"]["parts"][0]["text"]
    return "Unexpected response"

def approximate_token_count(text: str) -> int:
    # Rough estimate: tokens ≈ words * 1.3 (words split by whitespace)
    return int(len(text.split()) * 1.3)

def compress_text(text: str, max_lines: int = 50) -> str:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    # Remove lines with only numbers (page numbers etc)
    lines = [line for line in lines if not re.match(r"^\d+$", line)]
    return "\n".join(lines[:max_lines])




def load_cache_stage_db(query: str, stage: str, db: Session) -> str | None:
    query_hash = hashlib.md5(query.encode()).hexdigest()
    record = db.query(RAGCache).filter_by(query_hash=query_hash, stage=stage).first()
    return record.content if record else None

def save_cache_stage_db(query: str, stage: str, content: str, db: Session):
    query_hash = hashlib.md5(query.encode()).hexdigest()
    existing = db.query(RAGCache).filter_by(query_hash=query_hash, stage=stage).first()
    if existing:
        existing.content = content
    else:
        db.add(RAGCache(query_hash=query_hash, stage=stage, content=content))
    db.commit()


# PDF Content Chunking by Page
def extract_pdf_chunks() -> Dict[str, List[str]]:
    pdf_chunks = {}
    for filename in os.listdir(PDF_DIR):
        if filename.lower().endswith(".pdf"):
            full_path = os.path.join(PDF_DIR, filename)
            try:
                doc = fitz.open(full_path)
                pdf_chunks[filename] = [page.get_text().strip() for page in doc]
            except Exception as e:
                print(f"Failed to extract {filename}: {e}")
    return pdf_chunks

def search_pdf_chunks(chunks: Dict[str, List[str]], query: str) -> (str, List[Dict[str, Any]]):
    matches = []
    context_snippets = []

    for fname, pages in chunks.items():
        for i, page in enumerate(pages):
            if query.lower() in page.lower():
                match = {
                    "file": fname,
                    "page": i + 1,
                    "snippet": page[:500]
                }
                matches.append(match)
                context_snippets.append(f"File: {fname}, Page {i+1}:{page[:500]}")
            if len(matches) >= 5:
                break

    context_text = "\n\n".join(context_snippets) or "No relevant PDF content found."
    context_text = compress_text(context_text, max_lines=30)  # Compress context to reduce tokens
    return context_text, matches

def search_json_content(json_data: dict, query: str) -> str:
    results = []
    def recurse(d):
        if isinstance(d, dict):
            for k, v in d.items():
                if query.lower() in str(k).lower() or query.lower() in str(v).lower():
                    results.append(f"{k}: {v}")
                recurse(v)
        elif isinstance(d, list):
            for i in d:
                recurse(i)
    recurse(json_data)
    return compress_text("\n".join(results[:5]), max_lines=30) or "No matching content found."

def format_answers(answers: List[Dict[str, str]]) -> str:
    return "\n\n".join([f"[{a['model']}]:\n{a['answer'].strip()}" for a in answers])

def format_verifications(verifications: List[Dict[str, str]]) -> str:
    return "\n\n".join([f"[{v['model']}]:\n{v['verification'].strip()}" for v in verifications])

@app.post("/ragAI")
async def rag_ai(req: ExplainRequest, db: Session = Depends(get_db)):
    try:
        query = req.user_input
        debug_log = {}

        routing_result = load_cache_stage_db(query, "routing", db)
        pdf_context = load_cache_stage_db(query, "pdf_context", db)
        pdf_matches = load_cache_stage_db(query, "pdf_matches", db)
        json_context = load_cache_stage_db(query, "json_context", db)
        narrowed = load_cache_stage_db(query, "narrowed", db)

        if routing_result and pdf_context and pdf_matches and json_context and narrowed:
            print("[CACHE] Loaded all cached stages from DB")
        else:
            print("[0/6] Extracting PDF text...")
            pdf_chunks = extract_pdf_chunks()
            debug_log["pdf_samples"] = list(pdf_chunks.keys())[:3]

            if not routing_result:
                print("[1/6] Routing query...")
                routing_result = call_model("gpt-4-o-mini", [
                    {"role": "system", "content": "You route queries to 'PDF', 'JSON', or 'Both'."},
                    {"role": "user", "content": f"Query: {query}"}
                ]).lower()
                save_cache_stage_db(query, "routing", routing_result, db)
            debug_log["routing"] = routing_result
            debug_log["routing_tokens"] = approximate_token_count(routing_result)

            if not pdf_context or not pdf_matches:
                print("[2/6] Searching PDF context...")
                pdf_context_raw, pdf_matches_raw = search_pdf_chunks(pdf_chunks, query)
                pdf_context = pdf_context_raw
                pdf_matches = json.dumps(pdf_matches_raw, ensure_ascii=False)
                save_cache_stage_db(query, "pdf_context", pdf_context, db)
                save_cache_stage_db(query, "pdf_matches", pdf_matches, db)
            else:
                pdf_matches = json.loads(pdf_matches)

            debug_log["pdf_context_tokens"] = approximate_token_count(pdf_context)

            if not json_context:
                print("[2/6] Searching JSON context...")
                json_context = search_json_content(oracle_json, query)
                save_cache_stage_db(query, "json_context", json_context, db)
            debug_log["json_context_tokens"] = approximate_token_count(json_context)

            context = (
                pdf_context if "pdf" in routing_result and "json" not in routing_result
                else json_context if "json" in routing_result and "pdf" not in routing_result
                else f"{pdf_context}\n\n{json_context}"
            )

            if not narrowed:
                print("[3/6] Narrowing context...")
                narrowed = call_model("gpt-4-o-mini", [
                    {"role": "system", "content": "Narrow context to most relevant parts."},
                    {"role": "user", "content": f"Query: {query}\nContext:\n{context[:4000]}"}
                ])
                save_cache_stage_db(query, "narrowed", narrowed, db)
            debug_log["narrowed_tokens"] = approximate_token_count(narrowed)


        debug_log["pdf_matches"] = pdf_matches
        debug_log["selected_source"] = routing_result.upper()
        debug_log["narrowed_context"] = narrowed[:1000]

        # Generating answers
        print("[4/6] Generating answers...")
        gen_models = ["gpt-4-o", "gemini-1.5-pro"]
        answers = []
        total_gen_tokens = 0
        for m in gen_models:
            ans = call_model(m, [
                {"role": "system", "content": "Answer the query."},
                {"role": "user", "content": f"Query: {query}\nContext:\n{narrowed[:4000]}"}
            ])
            answers.append({"model": m, "answer": ans})
            total_gen_tokens += approximate_token_count(ans)
        debug_log["generation_tokens"] = total_gen_tokens

        # Verifying answers
        print("[5/6] Verifying answers...")
        ver_models = ["gpt-4-o", "deepseek-r1"]
        formatted_ans = format_answers(answers)
        verifications = []
        total_ver_tokens = 0
        for v in ver_models:
            verdict = call_model(v, [
                {"role": "system", "content": "Check factual accuracy and completeness of each answer."},
                {"role": "user", "content": f"Answers:\n{formatted_ans}\nContext:\n{narrowed[:3000]}"}
            ])
            verifications.append({"model": v, "verification": verdict})
            total_ver_tokens += approximate_token_count(verdict)
        debug_log["verification_tokens"] = total_ver_tokens

        # Arbitrating final answer
        print("[6/6] Arbitrating final answer...")
        arb_input = (
            f"Answers from two different AI models:\n{formatted_ans}\n\n"
            f"Expert verification comments:\n{format_verifications(verifications)}"
        )
        final = call_model("gpt-4-o-mini", [
            {
                "role": "system",
                "content": (
                    "You are an AI tutor helping beginners learn Java. "
                    "You are given two answers from different AI models and their respective verification comments. "
                    "Your job is to produce a single final answer that is:\n"
                    "- Based on the content of both model answers\n"
                    "- Informed by the verification feedback\n"
                    "- Concise, factually accurate, and easy for a beginner to understand\n\n"
                    "Avoid technical jargon. Do not explain your reasoning. "
                    "Output only the final answer, written in a friendly and beginner-friendly way."
                )
            },
            {
                "role": "user",
                "content": arb_input[:4000]
            }
        ])
        debug_log["final_answer_tokens"] = approximate_token_count(final)
        debug_log["final_answer"] = final

        # Sum tokens used approx
        debug_log["total_approx_tokens"] = (
                debug_log.get("routing_tokens", 0) +
                debug_log.get("pdf_context_tokens", 0) +
                debug_log.get("json_context_tokens", 0) +
                debug_log.get("narrowed_tokens", 0) +
                debug_log.get("generation_tokens", 0) +
                debug_log.get("verification_tokens", 0) +
                debug_log.get("final_answer_tokens", 0)
        )

        return {"final_answer": final, "debug_log": debug_log}

    except Exception as e:
        print("[ERROR] RAG pipeline failed")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
class CodeRequest(BaseModel):
    code_files: Dict[str, str]
    question_id: str

@app.post("/evaluate")
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

    # Pull solution runApp lines from JSON
    run_app_lines = question_data["solution"].get("runApp", [])

    # Generate runApp() method from JSON lines
    run_app_method = (
            "public void runApp() {\n"
            + "\n".join(f"    {line}" for line in run_app_lines)
            + "\n}")

    # Extract content inside the user's class definition
    class_body_match = re.search(r'public\s+class\s+\w+\s*\{(.*)\}', user_code, re.DOTALL)
    if class_body_match:
        user_code_body = class_body_match.group(1).strip()
    else:
        # Fallback if regex fails
        user_code_body = user_code

    # Remove any existing runApp method from user code to avoid re-definition error
    user_code_body = re.sub(r'public\s+void\s+runApp\s*\(\s*\)\s*\{.*?\}', '', user_code_body, flags=re.DOTALL)

    # Construct user's class, making it non-public so it can co-exist with the Main class
    user_class_code = f"class {base_class_name} {{\n{user_code_body}\n\n{run_app_method}\n}}"

    # Create a public Main class to act as the entry point for Paiza
    main_class_name = "Main"
    test_harness_code = f"public class {main_class_name} {{\n    public static void main(String[] args) {{\n        new {base_class_name}().runApp();\n    }}\n}}"

    # Combine them into a single source file content
    full_source = user_class_code + "\n\n" + test_harness_code

    # Submit code to Paiza API
    response = requests.post(
        "https://api.paiza.io/runners/create",
        data={
            "source_code": full_source,
            "language": "java",
            "api_key": PAIZA_API_KEY,
        }
    )

    run_id = response.json().get("id")
    if not run_id:
        return {"output": "Failed to start runner."}

    # Poll until complete
    while True:
        result = requests.get(
            "https://api.paiza.io/runners/get_details",
            params={"id": run_id, "api_key": PAIZA_API_KEY}
        ).json()
        if result.get("status") == "completed":
            break

    return {"output": result.get("stdout", "") or result.get("stderr", "") or result.get("build_stderr", "")}


@app.get("/questions")
def list_questions():
    if not os.path.exists(BASE_PATH):
        raise HTTPException(status_code=404, detail="Questions folder not found.")
    return [f for f in os.listdir(BASE_PATH) if f.endswith(".json")]

@app.get("/question/{question_id}")
def get_question(question_id: str):
    # Security check for question_id
    if ".." in question_id or "/" in question_id:
        raise HTTPException(status_code=400, detail="Invalid question ID.")
    
    file_path = os.path.join(BASE_PATH, question_id)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Question not found.")
    
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/questions/{set_id}")
def list_questions_by_set(set_id: str):
    # Security check for set_id
    if ".." in set_id or "/" in set_id:
        raise HTTPException(status_code=400, detail="Invalid set ID.")
        
    # Construct path relative to a base practical tests directory
    set_path = os.path.join("/Users/hei/IdeaProjects/fyp/practical_tests", set_id, "questions")
    
    if not os.path.isdir(set_path):
        raise HTTPException(status_code=404, detail=f"Question set '{set_id}' not found.")
        
    try:
        return [f for f in os.listdir(set_path) if f.endswith(".json")]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read question set: {e}")

@app.get("/lesson", response_class=JSONResponse)
def list_lessons():
    try:
        files = [f.replace(".json", "") for f in os.listdir(LESSON_DIR) if f.endswith(".json")]
        return files
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/lesson/{lesson_id}", response_class=JSONResponse)
def get_lesson(lesson_id: str):
    try:
        lesson_id = unquote(lesson_id)
        filepath = os.path.join(LESSON_DIR, f"{lesson_id}.json")
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Lesson {lesson_id} not found: {e}")





def extract_class_name(code: str) -> str:
    match = re.search(r"public\s+class\s+([A-Za-z_][A-Za-z0-9_]*)", code)
    return match.group(1) if match else "Main"


@app.post("/api/run-code")
async def run_code(request: Request):
    data = await request.json()
    code = data.get("code", "")

    # Try to extract public class name; fallback to 'Main'
    match = re.search(r"public\s+class\s+([A-Za-z_][A-Za-z0-9_]*)", code)
    class_name = match.group(1) if match else "Main"

    with tempfile.TemporaryDirectory() as tmp_dir:
        java_file_path = os.path.join(tmp_dir, f"{class_name}.java")

        with open(java_file_path, "w") as f:
            f.write(code)

        #Compile Java file
        compile_process = subprocess.run(
            ["javac", java_file_path],
            capture_output=True,
            text=True
        )

        if compile_process.returncode != 0:
            return JSONResponse(content={
                "output": "",
                "error": compile_process.stderr.strip()
            })

        #Run the compiled class
        run_process = subprocess.run(
            ["java", "-cp", tmp_dir, class_name],
            capture_output=True,
            text=True
        )

        output = run_process.stdout.strip() or "No output."
        error = run_process.stderr.strip()

        return {
            "output": output,
            "error": error
        }


@app.post("/api/check-syntax")
async def check_syntax(request: Request):
    data = await request.json()
    code = data.get("code", "")
    class_name = extract_class_name(code)

    with tempfile.TemporaryDirectory() as tmp:
        file_path = os.path.join(tmp, f"{class_name}.java")
        with open(file_path, "w") as f:
            f.write(code)

        compile = subprocess.run(["javac", file_path], capture_output=True, text=True)
        errors = []
        if compile.stderr:
            for line in compile.stderr.splitlines():
                # Match lines like: Main.java:5: error: ';' expected
                m = re.match(rf"{class_name}\.java:(\d+):\s+(error:.*?)$", line)
                if m:
                    line_number = int(m.group(1))
                    message = m.group(2).strip()
                    errors.append({"line": line_number, "message": message})

        return {"errors": errors}


@app.get("/list-pdfs")
def list_pdfs() -> List[str]:
    try:
        return [f for f in os.listdir(PDF_DIR) if f.lower().endswith(".pdf")]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/pdf-files/{filename}")
def serve_pdf(filename: str = Path(...)):
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = os.path.join(PDF_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path=path, media_type="application/pdf")
