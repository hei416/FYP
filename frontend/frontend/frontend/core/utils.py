import re
from typing import List, Dict

def get_model_type(model: str) -> str:
    if model.startswith("gpt") or model.startswith("o1"):
        return "gpt"
    elif model.startswith("gemini"):
        return "gemini"
    return "deepseek"

def approximate_token_count(text: str) -> int:
    return int(len(text.split()) * 1.3)

def compress_text(text: str, max_lines: int = 50) -> str:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    lines = [line for line in lines if not re.match(r"^\d+$", line)]
    return "\n".join(lines[:max_lines])

def extract_class_name(code: str) -> str:
    match = re.search(r"public\s+class\s+([A-Za-z_][A-Za-z0-9_]*)", code)
    return match.group(1) if match else "Main"

def format_answers(answers: List[Dict[str, str]]) -> str:
    return "\n\n".join([f"[{a['model']}]:\n{a['answer'].strip()}" for a in answers])

def format_verifications(verifications: List[Dict[str, str]]) -> str:
    return "\n\n".join([f"[{v['model']}]:\n{v['verification'].strip()}" for v in verifications])
