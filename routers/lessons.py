import os
import json
from urllib.parse import unquote
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from core.config import LESSON_DIR

router = APIRouter()

@router.get("/lessons", response_class=JSONResponse)
def list_lessons():
    try:
        return [f.replace(".json", "") for f in os.listdir(LESSON_DIR) if f.endswith(".json")]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/lessons/{lesson_id}", response_class=JSONResponse)
def get_lesson(lesson_id: str):
    try:
        lesson_id = unquote(lesson_id)
        filepath = os.path.join(LESSON_DIR, f"{lesson_id}.json")
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Lesson not found: {e}")
