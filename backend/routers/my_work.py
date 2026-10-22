from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from db_models import SavedWork, User
from routers.auth import get_current_user
from pydantic import BaseModel, field_validator
from typing import Optional, Any
import datetime

router = APIRouter(prefix="/my-work", tags=["my-work"])

VALID_WORK_TYPES = {"playground", "quiz", "test"}


class SaveWorkRequest(BaseModel):
    work_type: str          # 'playground', 'quiz', 'test'
    title: str
    topic_id: Optional[str] = None
    content: Optional[str] = None
    result_data: Optional[Any] = None

    @field_validator("work_type")
    @classmethod
    def work_type_whitelist(cls, v: str) -> str:
        # S19: this table feeds all teacher analytics dashboards — an
        # unrecognized work_type would silently slip past every downstream
        # aggregation that filters on these exact three values.
        if v not in VALID_WORK_TYPES:
            raise ValueError(f"work_type must be one of {sorted(VALID_WORK_TYPES)}")
        return v


def _sanitize_result_data(work_type: str, result_data: Optional[Any]) -> Optional[Any]:
    """S19: clamp/validate the client-reported score instead of trusting it
    verbatim — this is the only guard available short of re-grading quiz/test
    attempts server-side (those already have their own graded endpoints;
    this is the free-form "save my work" path)."""
    if work_type not in ("quiz", "test") or not isinstance(result_data, dict):
        return result_data
    score = result_data.get("score")
    if score is not None:
        try:
            score = float(score)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="result_data.score must be a number")
        result_data = {**result_data, "score": max(0.0, min(100.0, score))}
    return result_data


@router.post("/save")
def save_work(body: SaveWorkRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    body.result_data = _sanitize_result_data(body.work_type, body.result_data)
    item = SavedWork(
        user_id=current_user.id,
        work_type=body.work_type,
        title=body.title,
        topic_id=body.topic_id,
        content=body.content,
        result_data=body.result_data,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": item.id, "message": "Saved successfully"}


@router.get("/list")
def list_work(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    items = db.query(SavedWork).filter(SavedWork.user_id == current_user.id).order_by(SavedWork.created_at.desc()).all()
    return [
        {
            "id": i.id,
            "work_type": i.work_type,
            "title": i.title,
            "topic_id": i.topic_id,
            "content": i.content,
            "result_data": i.result_data,
            "created_at": i.created_at.isoformat(),
        }
        for i in items
    ]


@router.delete("/{item_id}")
def delete_work(item_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = db.query(SavedWork).filter(SavedWork.id == item_id, SavedWork.user_id == current_user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(item)
    db.commit()
    return {"message": "Deleted"}
