"""Admin-only endpoints for platform management."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional, Dict, Any

from database import get_db
from db_models import User, Classroom, ClassroomMember
from routers.auth import require_role, hash_password

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


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None


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


@router.patch("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin"))
):
    """Update user details: full_name, email, or password (admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if data.full_name is not None:
        user.full_name = data.full_name
    if data.email is not None:
        # Check if email is already taken
        existing = db.query(User).filter(User.email == data.email, User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        user.email = data.email
    if data.password is not None:
        user.password_hash = hash_password(data.password)
    
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


# ---------------------------------------------------------------------------
# Classroom students performance
# ---------------------------------------------------------------------------

@router.get("/classrooms/{classroom_id}/students")
async def get_classroom_students(
    classroom_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Proxy to the full classroom analytics used by the teacher dashboard."""
    from routers.classroom import get_classroom_analytics
    return await get_classroom_analytics(
        classroom_id=classroom_id,
        db=db,
        current_user=current_user,
    )


# ---------------------------------------------------------------------------
# NLI Faithfulness Monitoring
# ---------------------------------------------------------------------------

class NLIStatsOut(BaseModel):
    """NLI monitoring dashboard statistics."""
    total_queries: int
    low_faithfulness_count: int
    faithfulness_rate: float  # 0.0 to 1.0
    avg_nli_score: float
    period: str
    recent_alerts: List[Dict[str, Any]]  # Last 5 low-faithfulness responses


@router.get("/nli-monitoring/stats")
async def get_nli_monitoring_stats(
    hours: int = 24,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
) -> NLIStatsOut:
    """
    Get NLI faithfulness monitoring statistics for the admin dashboard.
    
    Returns summary stats and recent alerts for responses with low NLI scores.
    """
    from db_models import NLIMonitoringLog
    from datetime import datetime, timedelta
    
    # Time window
    cutoff = datetime.utcnow() - timedelta(hours=hours)
    
    # Query stats
    total_queries = db.query(NLIMonitoringLog).filter(
        NLIMonitoringLog.checked_at >= cutoff
    ).count()
    
    low_faith = db.query(NLIMonitoringLog).filter(
        NLIMonitoringLog.checked_at >= cutoff,
        NLIMonitoringLog.is_faithful == False
    ).count()
    
    avg_score = db.query(func.avg(NLIMonitoringLog.nli_score)).filter(
        NLIMonitoringLog.checked_at >= cutoff
    ).scalar() or 0.0
    
    faithfulness_rate = (1.0 - (low_faith / total_queries)) if total_queries > 0 else 1.0
    
    # Recent alerts (last 5 low-faithfulness responses)
    recent_alerts_query = db.query(
        NLIMonitoringLog.query_id,
        NLIMonitoringLog.nli_score,
        NLIMonitoringLog.status,
        NLIMonitoringLog.checked_at
    ).filter(
        NLIMonitoringLog.checked_at >= cutoff,
        NLIMonitoringLog.is_faithful == False
    ).order_by(
        NLIMonitoringLog.checked_at.desc()
    ).limit(5).all()
    
    recent_alerts = [
        {
            "query_id": row.query_id,
            "score": round(row.nli_score, 3),
            "status": row.status,
            "checked_at": row.checked_at.isoformat()
        }
        for row in recent_alerts_query
    ]
    
    return NLIStatsOut(
        total_queries=total_queries,
        low_faithfulness_count=low_faith,
        faithfulness_rate=round(faithfulness_rate, 3),
        avg_nli_score=round(float(avg_score), 3),
        period=f"last {hours} hours",
        recent_alerts=recent_alerts
    )