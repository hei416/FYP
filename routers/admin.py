"""Admin-only endpoints for platform management."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

from database import get_db
from db_models import User, Classroom, ClassroomMember
from routers.auth import require_role

router = APIRouter(prefix="/admin", tags=["Admin"])


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class UserOut(BaseModel):
    id: int
    email: str
    full_name: Optional[str]
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


class RoleUpdate(BaseModel):
    role: str  # 'student' | 'teacher' | 'admin'


class ClassroomAdminOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    class_code: str
    teacher_id: int
    teacher_name: Optional[str]
    teacher_email: str
    student_count: int
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# User management
# ---------------------------------------------------------------------------

@router.get("/users", response_model=List[UserOut])
async def list_all_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin"))
):
    """Return every user account ordered by creation date."""
    return db.query(User).order_by(User.created_at.desc()).all()


@router.patch("/users/{user_id}/role", response_model=UserOut)
async def update_user_role(
    user_id: int,
    data: RoleUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_role("admin"))
):
    """Change a user's role. Admin cannot demote themselves."""
    if data.role not in ("student", "teacher", "admin"):
        raise HTTPException(status_code=400, detail="role must be student, teacher, or admin")
    if user_id == current_admin.id:
        raise HTTPException(status_code=400, detail="You cannot change your own role")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = data.role
    db.commit()
    db.refresh(user)
    return user


# ---------------------------------------------------------------------------
# Classroom management
# ---------------------------------------------------------------------------

@router.get("/classrooms", response_model=List[ClassroomAdminOut])
async def list_all_classrooms(
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin"))
):
    """Return every classroom with teacher info and student count."""
    classrooms = db.query(Classroom).order_by(Classroom.created_at.desc()).all()
    result = []
    for cls in classrooms:
        teacher = db.query(User).filter(User.id == cls.teacher_id).first()
        student_count = db.query(func.count(ClassroomMember.id)).filter(
            ClassroomMember.classroom_id == cls.id
        ).scalar()
        result.append(ClassroomAdminOut(
            id=cls.id,
            name=cls.name,
            description=cls.description,
            class_code=cls.class_code,
            teacher_id=cls.teacher_id,
            teacher_name=teacher.full_name if teacher else None,
            teacher_email=teacher.email if teacher else "(deleted)",
            student_count=student_count or 0,
            created_at=cls.created_at,
        ))
    return result


@router.delete("/classrooms/{classroom_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_classroom(
    classroom_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin"))
):
    """Permanently delete a classroom and remove all its members."""
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    db.query(ClassroomMember).filter(ClassroomMember.classroom_id == classroom_id).delete()
    db.delete(classroom)
    db.commit()
