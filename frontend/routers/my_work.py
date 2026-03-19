from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from db_models import SavedWork, User
from routers.auth import get_current_user
from pydantic import BaseModel
from typing import Optional, Any
import datetime

router = APIRouter(prefix="/my-work", tags=["my-work"])

class SaveWorkRequest(BaseModel):
    work_type: str          # 'playground', 'quiz', 'test'
    title: str
    topic_id: Optional[str] = None
    content: Optional[str] = None
    result_data: Optional[Any] = None


@router.post("/save")
def save_work(body: SaveWorkRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
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
