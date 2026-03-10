import os
import fitz  # PyMuPDF
import json
import requests
import re
from tqdm import tqdm

PDF_DIR = "/Users/hei/IdeaProjects/fyp/frontend/Lecture Notes-20250622"
OUTPUT_DIR = "./lessons_raw"
OLLAMA_MODEL = "deepseek-coder:6.7b"

os.makedirs(OUTPUT_DIR, exist_ok=True)

# Step 1: Extract all text
def extract_text_from_pdf(pdf_path):
    doc = fitz.open(pdf_path)
    return "\n\n".join([page.get_text() for page in doc if page.get_text().strip()])

# Step 2: Optional content generation via Ollama
def call_ollama(prompt: str) -> str:
    response = requests.post(
        "http://localhost:11434/api/generate",
        json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
    )
    if response.ok:
        return response.json()["response"].strip()
    raise Exception(f"Ollama call failed: {response.status_code} {response.text}")

# Step 3: Split into sections (naive heading detection)
def split_into_sections(text):
    pattern = re.compile(r"\n(?P<heading>([A-Z][^\n]{2,50}))\n")
    matches = list(pattern.finditer(text))

    if not matches:
        return [{"heading": "Full Content", "content": text.strip()}]

    sections = []
    for i in range(len(matches)):
        heading = matches[i].group("heading").strip()
        start = matches[i].end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        content = text[start:end].strip()
        sections.append({"heading": heading, "content": content})
    return sections

# Step 4: Build JSON per PDF
def build_lesson_json(pdf_path):
    filename = os.path.splitext(os.path.basename(pdf_path))[0]
    raw_text = extract_text_from_pdf(pdf_path)

    sections = split_into_sections(raw_text)
    updated_sections = []
    # Process sections in batches of 50 with a progress bar
    for i in tqdm(range(0, len(sections), 50), desc=f"Processing sections for {filename}"):
        batch = sections[i:i+50]
        for section in batch:
            heading = section["heading"]
            content = section["content"]
            if len(content.strip()) < 30:
                # This part with call_ollama can be slow, consider if you want to keep it.
                # For now, I'll leave it as is, but the progress bar will show the batching.
                prompt = (
                    "You are an expert Java tutor. You will be given a structured JSON object that represents a lesson "
                    "parsed from a lecture PDF. Your job is to:\n"
                    "- Rephrase or clarify vague or choppy sections.\n"
                    "- Expand on weak or empty content with better explanations or relevant code examples.\n"
                    "- Keep the JSON structure the same.\n"
                    
