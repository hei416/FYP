from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional, Dict, Any
import random
import string
import shutil, uuid, os

from database import get_db
from db_models import User, Classroom, ClassroomMember, UserProgress, SavedWork, ClassroomDocument
from routers.auth import get_current_user, require_role
from services.classroom_rag import ingest_document

router = APIRouter(prefix="/classrooms", tags=["Classroom"])

# ---------------------------------------------------------------------------
# Document upload & delete endpoints
# ---------------------------------------------------------------------------

@router.post("/{classroom_id}/documents")
async def upload_document(
    classroom_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(404, "Classroom not found")
    if current_user.role not in ["admin"] and classroom.teacher_id != current_user.id:
        raise HTTPException(403, "Only the classroom teacher can upload documents")

    ext = file.filename.split(".")[-1]
    tmp_path = f"/tmp/{uuid.uuid4()}.{ext}"
    with open(tmp_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    chunk_count = ingest_document(classroom_id, tmp_path, file.filename)
    os.remove(tmp_path)

    doc = ClassroomDocument(
        classroom_id=classroom_id, uploaded_by=current_user.id,
        filename=f"{classroom_id}/{file.filename}", original_name=file.filename,
        file_type=ext, status="ready", chunk_count=chunk_count
    )
    db.add(doc)
    db.commit()
    return {"message": "Document uploaded", "chunks": chunk_count}


@router.get("/{classroom_id}/documents")
async def list_documents(
    classroom_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(404, "Classroom not found")
    return db.query(ClassroomDocument).filter(
        ClassroomDocument.classroom_id == classroom_id
    ).all()


@router.delete("/{classroom_id}/documents/{doc_id}")
async def delete_document(
    classroom_id: int,
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(404, "Classroom not found")
    if current_user.role not in ["admin"] and classroom.teacher_id != current_user.id:
        raise HTTPException(403, "Forbidden")
    doc = db.query(ClassroomDocument).filter(
        ClassroomDocument.id == doc_id,
        ClassroomDocument.classroom_id == classroom_id
    ).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    db.delete(doc)
    db.commit()
    return {"message": "Document deleted"}
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional, Dict, Any
import random
import string

from database import get_db
from db_models import User, Classroom, ClassroomMember, UserProgress, SavedWork, ClassroomDocument
from fastapi import UploadFile, File
import shutil, uuid, os
from services.classroom_rag import ingest_document
# ---------------------------------------------------------------------------
# Document upload & delete endpoints
# ---------------------------------------------------------------------------

@router.post("/{classroom_id}/documents")
async def upload_document(
    classroom_id: int,
    file: UploadFile = File(...),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Only teacher who owns the classroom (or admin) can upload
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(404, "Classroom not found")
    if current_user.role not in ["admin"] and classroom.teacher_id != current_user.id:
        raise HTTPException(403, "Only the classroom teacher can upload documents")

    # Save file temporarily
    ext = file.filename.split(".")[-1]
    tmp_path = f"/tmp/{uuid.uuid4()}.{ext}"
    with open(tmp_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Ingest into classroom FAISS
    chunk_count = ingest_document(classroom_id, tmp_path, file.filename)
    os.remove(tmp_path)

    # Save record to DB
    doc = ClassroomDocument(
        classroom_id=classroom_id, uploaded_by=current_user.id,
        filename=f"{classroom_id}/{file.filename}", original_name=file.filename,
        file_type=ext, status="ready", chunk_count=chunk_count
    )
    db.add(doc)
    db.commit()
    return {"message": "Document uploaded", "chunks": chunk_count}


@router.delete("/{classroom_id}/documents/{doc_id}")
async def delete_document(classroom_id: int, doc_id: int, current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    # Admin or owning teacher only — delete DB record
    # Note: full re-index needed for FAISS (see service)
    ...
from routers.auth import get_current_user, require_role

router = APIRouter(prefix="/classrooms", tags=["Classroom"])


def generate_class_code(length: int = 8) -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=length))


def unique_class_code(db: Session) -> str:
    for _ in range(10):
        code = generate_class_code()
        if not db.query(Classroom).filter(Classroom.class_code == code).first():
            return code
    raise HTTPException(status_code=500, detail="Could not generate a unique class code.")


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


class TopicStat(BaseModel):
    topic: str
    exercise_attempts: int
    exercise_avg_score: Optional[float]
    challenge_attempts: int
    challenge_avg_score: Optional[float]
    is_weak: bool


class StudentSummary(BaseModel):
    student_id: int
    full_name: Optional[str]
    email: str
    completed_topics: int
    quizzes_attempted: int
    quizzes_passed: int
    avg_quiz_score: Optional[float]
    tests_attempted: int
    tests_passed: int
    ai_interactions: int
    joined_at: datetime
    last_active: Optional[datetime]
    topic_stats: List[TopicStat]
    weak_topics: List[str]


class ClassSummary(BaseModel):
    avg_exercise_score: Optional[float]
    avg_challenge_score: Optional[float]
    quiz_pass_rate: Optional[float]        # % of all exercise sessions that passed (>=70)
    challenge_pass_rate: Optional[float]   # % of all challenge sessions that passed (>=60)
    most_common_weak_topics: List[str]


class ClassroomAnalytics(BaseModel):
    classroom_id: int
    classroom_name: str
    total_students: int
    class_summary: ClassSummary
    students: List[StudentSummary]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _score_of(result_data: Any) -> Optional[float]:
    if not result_data:
        return None
    if isinstance(result_data, dict):
        s = result_data.get("score")
        if isinstance(s, (int, float)):
            return float(s)
    return None


def _topics_of(work: SavedWork) -> List[str]:
    rd = work.result_data or {}
    for key in ("topics_covered", "topics"):
        val = rd.get(key)
        if isinstance(val, list) and val:
            return [str(t) for t in val]
    if work.topic_id:
        return [work.topic_id]
    return []


def _build_topic_stats(works: List[SavedWork], work_type: str) -> Dict[str, Dict]:
    """Aggregate per-topic attempt counts and avg scores for a given work_type."""
    topic_scores: Dict[str, List[float]] = {}
    for w in works:
        if w.work_type != work_type:
            continue
        score = _score_of(w.result_data)
        for topic in _topics_of(w):
            topic_scores.setdefault(topic, [])
            if score is not None:
                topic_scores[topic].append(score)
            else:
                topic_scores[topic]
    result = {}
    for topic, scores in topic_scores.items():
        result[topic] = {
            "attempts": len(scores),
            "avg": round(sum(scores) / len(scores), 1) if scores else None,
        }
    return result


# ---------------------------------------------------------------------------
# Teacher endpoints
# ---------------------------------------------------------------------------

@router.post("", response_model=ClassroomResponse, status_code=status.HTTP_201_CREATED)
async def create_classroom(
    data: ClassroomCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin"))
):
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
    return db.query(Classroom).filter(Classroom.teacher_id == current_user.id).all()


@router.get("/{classroom_id}/analytics", response_model=ClassroomAnalytics)
async def get_classroom_analytics(
    classroom_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin"))
):
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
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
        progress = db.query(UserProgress).filter(UserProgress.user_id == student.id).first()

        completed_topics_count = (
            len(progress.completed_topics)
            if progress and isinstance(progress.completed_topics, list) else 0
        )
        ai_interactions = progress.ai_interactions if progress else 0

        all_works = (
            db.query(SavedWork)
            .filter(SavedWork.user_id == student.id)
            .order_by(SavedWork.created_at.desc())
            .all()
        )

        last_active = all_works[0].created_at if all_works else None

        # --- Exercises ---
        quiz_works = [w for w in all_works if w.work_type == "quiz"]
        quiz_scores = [_score_of(w.result_data) for w in quiz_works if _score_of(w.result_data) is not None]
        quizzes_attempted = len(quiz_works)
        quizzes_passed = sum(1 for sc in quiz_scores if sc >= 70)
        avg_quiz_score = round(sum(quiz_scores) / len(quiz_scores), 2) if quiz_scores else None

        # --- Challenges ---
        test_works = [w for w in all_works if w.work_type == "test"]
        tests_attempted_count = len(test_works)
        tests_passed_count = sum(
            1 for w in test_works
            if _score_of(w.result_data) is not None and _score_of(w.result_data) >= 60
        )

        # Per-topic stats
        quiz_topic_stats = _build_topic_stats(all_works, "quiz")
        test_topic_stats = _build_topic_stats(all_works, "test")
        all_topics = set(list(quiz_topic_stats.keys()) + list(test_topic_stats.keys()))

        topic_stats_list: List[TopicStat] = []
        weak_topics: List[str] = []

        for topic in sorted(all_topics):
            q = quiz_topic_stats.get(topic, {"attempts": 0, "avg": None})
            t = test_topic_stats.get(topic, {"attempts": 0, "avg": None})
            is_weak = (
                (q["avg"] is not None and q["avg"] < 70) or
                (t["avg"] is not None and t["avg"] < 70)
            )
            if is_weak:
                weak_topics.append(topic)
            topic_stats_list.append(TopicStat(
                topic=topic,
                exercise_attempts=q["attempts"],
                exercise_avg_score=q["avg"],
                challenge_attempts=t["attempts"],
                challenge_avg_score=t["avg"],
                is_weak=is_weak,
            ))

        student_summaries.append(StudentSummary(
            student_id=student.id,
            full_name=student.full_name,
            email=student.email,
            completed_topics=completed_topics_count,
            quizzes_attempted=quizzes_attempted,
            quizzes_passed=quizzes_passed,
            avg_quiz_score=avg_quiz_score,
            tests_attempted=tests_attempted_count,
            tests_passed=tests_passed_count,
            ai_interactions=ai_interactions,
            joined_at=member.joined_at,
            last_active=last_active,
            topic_stats=topic_stats_list,
            weak_topics=weak_topics,
        ))

    # Class-level summary
    all_quiz_scores = [s.avg_quiz_score for s in student_summaries if s.avg_quiz_score is not None]
    all_test_scores = [
        _score_of(w.result_data)
        for member, student in members
        for w in db.query(SavedWork).filter(
            SavedWork.user_id == student.id,
            SavedWork.work_type == "test"
        ).all()
        if _score_of(w.result_data) is not None
    ]

    # quiz_pass_rate: % of all exercise sessions scoring >= 70 (class-wide)
    total_quiz_attempted = sum(s.quizzes_attempted for s in student_summaries)
    total_quiz_passed    = sum(s.quizzes_passed    for s in student_summaries)
    quiz_pass_rate = round(total_quiz_passed / total_quiz_attempted * 100, 1) if total_quiz_attempted > 0 else None

    # challenge_pass_rate: % of all challenge sessions scoring >= 60 (class-wide)
    total_tests_attempted = sum(s.tests_attempted for s in student_summaries)
    total_tests_passed    = sum(s.tests_passed    for s in student_summaries)
    challenge_pass_rate = round(total_tests_passed / total_tests_attempted * 100, 1) if total_tests_attempted > 0 else None

    weak_topic_freq: Dict[str, int] = {}
    for s in student_summaries:
        for t in s.weak_topics:
            weak_topic_freq[t] = weak_topic_freq.get(t, 0) + 1
    most_common_weak = sorted(weak_topic_freq, key=lambda x: -weak_topic_freq[x])[:5]

    class_summary = ClassSummary(
        avg_exercise_score=round(sum(all_quiz_scores) / len(all_quiz_scores), 1) if all_quiz_scores else None,
        avg_challenge_score=round(sum(all_test_scores) / len(all_test_scores), 1) if all_test_scores else None,
        quiz_pass_rate=quiz_pass_rate,
        challenge_pass_rate=challenge_pass_rate,
        most_common_weak_topics=most_common_weak,
    )

    return ClassroomAnalytics(
        classroom_id=classroom.id,
        classroom_name=classroom.name,
        total_students=len(student_summaries),
        class_summary=class_summary,
        students=student_summaries,
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
    classroom = db.query(Classroom).filter(
        Classroom.class_code == data.class_code.upper().strip()
    ).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Invalid class code")

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
    return {"status": "joined", "classroom_id": classroom.id, "classroom_name": classroom.name}


@router.get("/enrolled", response_model=List[ClassroomResponse])
async def list_enrolled_classrooms(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("student"))
):
    memberships = (
        db.query(ClassroomMember)
        .filter(ClassroomMember.student_id == current_user.id)
        .all()
    )
    classroom_ids = [m.classroom_id for m in memberships]
    return db.query(Classroom).filter(Classroom.id.in_(classroom_ids)).all()
