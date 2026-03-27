from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
import random
import string

from database import get_db
from db_models import User, Classroom, ClassroomMember, UserProgress, QuizAttempt, TestAttempt
from routers.auth import get_current_user, require_role

router = APIRouter(prefix="/classrooms", tags=["Classroom"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def generate_class_code(length: int = 8) -> str:
    """Generate a random uppercase alphanumeric class join code."""
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=length))


def unique_class_code(db: Session) -> str:
    """Keep generating until we find a code not already in use."""
    for _ in range(10):
        code = generate_class_code()
        if not db.query(Classroom).filter(Classroom.class_code == code).first():
            return code
    raise HTTPException(status_code=500, detail="Could not generate a unique class code. Try again.")


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class ClassroomCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ClassroomResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    class_code: str
    teacher_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class JoinClassroomRequest(BaseModel):
    class_code: str


class StudentSummary(BaseModel):
    student_id: int
    full_name: Optional[str]
    email: str
    completed_topics: int
    quizzes_attempted: int
    avg_quiz_score: Optional[float]
    tests_attempted: int
    tests_passed: int
    ai_interactions: int
    joined_at: datetime


class ClassroomAnalytics(BaseModel):
    classroom_id: int
    classroom_name: str
    total_students: int
    students: List[StudentSummary]


# ---------------------------------------------------------------------------
# Teacher endpoints
# ---------------------------------------------------------------------------

@router.post("", response_model=ClassroomResponse, status_code=status.HTTP_201_CREATED)
async def create_classroom(
    data: ClassroomCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin"))
):
    """Create a new classroom. Only teachers and admins can create classrooms."""
    code = unique_class_code(db)
    classroom = Classroom(
        name=data.name,
        description=data.description,
        class_code=code,
        teacher_id=current_user.id
    )
    db.add(classroom)
    db.commit()
    db.refresh(classroom)
    return classroom


@router.get("/my", response_model=List[ClassroomResponse])
async def list_my_classrooms(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin"))
):
    """List all classrooms owned by the current teacher."""
    return db.query(Classroom).filter(Classroom.teacher_id == current_user.id).all()


@router.get("/{classroom_id}/analytics", response_model=ClassroomAnalytics)
async def get_classroom_analytics(
    classroom_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin"))
):
    """
    Return per-student analytics for a classroom.
    Teachers can only view their own classrooms; admins can view any.
    """
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    # Teachers can only see their own classrooms
    if current_user.role == "teacher" and classroom.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not own this classroom")

    members = (
        db.query(ClassroomMember, User)
        .join(User, ClassroomMember.student_id == User.id)
        .filter(ClassroomMember.classroom_id == classroom_id)
        .all()
    )

    student_summaries = []
    for member, student in members:
        # Progress record
        progress = db.query(UserProgress).filter(UserProgress.user_id == student.id).first()

        # Average quiz score from QuizAttempt table
        avg_quiz = (
            db.query(func.avg(QuizAttempt.score))
            .filter(QuizAttempt.user_id == student.id)
            .scalar()
        )

        # Test stats from TestAttempt table
        test_count = (
            db.query(func.count(TestAttempt.id))
            .filter(TestAttempt.user_id == student.id)
            .scalar()
        )
        test_passed = (
            db.query(func.count(TestAttempt.id))
            .filter(TestAttempt.user_id == student.id, TestAttempt.passed == True)
            .scalar()
        )

        student_summaries.append(StudentSummary(
            student_id=student.id,
            full_name=student.full_name,
            email=student.email,
            completed_topics=len(progress.completed_topics) if progress and progress.completed_topics else 0,
            quizzes_attempted=progress.quizzes_attempted if progress else 0,
            avg_quiz_score=round(avg_quiz, 2) if avg_quiz is not None else None,
            tests_attempted=test_count or 0,
            tests_passed=test_passed or 0,
            ai_interactions=progress.ai_interactions if progress else 0,
            joined_at=member.joined_at
        ))

    return ClassroomAnalytics(
        classroom_id=classroom.id,
        classroom_name=classroom.name,
        total_students=len(student_summaries),
        students=student_summaries
    )


# ---------------------------------------------------------------------------
# Student endpoints
# ---------------------------------------------------------------------------

@router.post("/join", status_code=status.HTTP_200_OK)
async def join_classroom(
    data: JoinClassroomRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("student"))
):
    """Student joins a classroom by entering the class code."""
    classroom = db.query(Classroom).filter(
        Classroom.class_code == data.class_code.upper().strip()
    ).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Invalid class code")

    # Check already a member
    already_member = db.query(ClassroomMember).filter(
        ClassroomMember.classroom_id == classroom.id,
        ClassroomMember.student_id == current_user.id
    ).first()
    if already_member:
        raise HTTPException(status_code=409, detail="You are already in this classroom")

    membership = ClassroomMember(
        classroom_id=classroom.id,
        student_id=current_user.id
    )
    db.add(membership)
    db.commit()

    return {
        "status": "joined",
        "classroom_id": classroom.id,
        "classroom_name": classroom.name
    }


@router.get("/enrolled", response_model=List[ClassroomResponse])
async def list_enrolled_classrooms(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("student"))
):
    """List all classrooms a student is enrolled in."""
    memberships = (
        db.query(ClassroomMember)
        .filter(ClassroomMember.student_id == current_user.id)
        .all()
    )
    classroom_ids = [m.classroom_id for m in memberships]
    return db.query(Classroom).filter(Classroom.id.in_(classroom_ids)).all()
