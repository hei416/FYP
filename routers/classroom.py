from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Response, Header
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional, Dict, Any
import random
import string
import shutil, uuid, os, time, json
import httpx

from database import get_db
from db_models import User, Classroom, ClassroomMember, UserProgress, SavedWork, ClassroomDocument, ClassroomFile, ClassroomChunk, ClassroomSection, ClassroomQuiz
from routers.auth import get_current_user, require_role
from services.classroom_rag import (
    ingest_document, upload_and_index, delete_classroom_file,
    search_classroom_context, get_chunks_for_files,
)

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
    quiz_pass_rate: Optional[float]
    challenge_pass_rate: Optional[float]
    most_common_weak_topics: List[str]


class ClassroomAnalytics(BaseModel):
    classroom_id: int
    classroom_name: str
    total_students: int
    class_summary: ClassSummary
    students: List[StudentSummary]


class FileMetaResponse(BaseModel):
    id: int
    filename: str
    mime_type: str
    uploaded_at: str
    section_id: Optional[int] = None

    class Config:
        from_attributes = True


class SectionCreate(BaseModel):
    name: str
    description: Optional[str] = None
    order: int = 0


class SectionRename(BaseModel):
    name: str


class SectionResponse(BaseModel):
    id: int
    classroom_id: int
    name: str
    description: Optional[str]
    order: int
    created_at: datetime
    files: List[FileMetaResponse] = []

    class Config:
        from_attributes = True


class MoveFileRequest(BaseModel):
    section_id: Optional[int] = None  # None to unsection


class ClassroomAskRequest(BaseModel):
    question: str
    mode: str = "classroom"  # "classroom" | "general"


# ---------------------------------------------------------------------------
# Quiz Pydantic schemas
# ---------------------------------------------------------------------------

class QuizMCQ(BaseModel):
    id: str
    question: str
    options: List[str]
    correct_index: int
    explanation: str


class GenerateClassroomQuizRequest(BaseModel):
    topic_prompt: str
    num_questions: int = 5
    section_id: Optional[int] = None
    file_ids: Optional[List[int]] = None  # if set, restrict context to these files


class SaveClassroomQuizRequest(BaseModel):
    title: str
    topic_prompt: Optional[str] = None
    questions: List[dict]
    section_id: Optional[int] = None
    status: str = "draft"  # "draft" | "published"


class UpdateClassroomQuizRequest(BaseModel):
    title: Optional[str] = None
    questions: Optional[List[dict]] = None
    section_id: Optional[int] = None
    status: Optional[str] = None


class ClassroomQuizResponse(BaseModel):
    id: int
    classroom_id: int
    section_id: Optional[int]
    title: str
    topic_prompt: Optional[str]
    questions: List[dict]
    status: str
    created_by: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


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

    total_quiz_attempted = sum(s.quizzes_attempted for s in student_summaries)
    total_quiz_passed    = sum(s.quizzes_passed    for s in student_summaries)
    quiz_pass_rate = round(total_quiz_passed / total_quiz_attempted * 100, 1) if total_quiz_attempted > 0 else None

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
    current_user: User = Depends(get_current_user)
):
    """List classrooms for the current user: 
    - Students: classrooms they're enrolled in
    - Teachers: classrooms they teach
    - Admins: all classrooms
    """
    print(f"📚 [CLASSROOM] Fetching enrolled classrooms for user {current_user.id} (role={current_user.role})")
    if current_user.role == "admin":
        classrooms = db.query(Classroom).all()
        print(f"   → Admin: returning all {len(classrooms)} classrooms")
        return classrooms
    elif current_user.role == "teacher":
        classrooms = db.query(Classroom).filter(Classroom.teacher_id == current_user.id).all()
        print(f"   → Teacher: returning {len(classrooms)} classrooms they teach")
        return classrooms
    else:  # student
        memberships = (
            db.query(ClassroomMember)
            .filter(ClassroomMember.student_id == current_user.id)
            .all()
        )
        classroom_ids = [m.classroom_id for m in memberships]
        print(f"   → Student: enrolled in classrooms: {classroom_ids}")
        if not classroom_ids:
            print(f"   → No classrooms found")
            return []
        classrooms = db.query(Classroom).filter(Classroom.id.in_(classroom_ids)).all()
        print(f"   → Returning {len(classrooms)} classrooms")
        return classrooms


# ---------------------------------------------------------------------------
# Legacy document management endpoints (kept for backwards compatibility)
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

    ext = file.filename.split(".")[-1].lower()
    tmp_path = f"/tmp/{uuid.uuid4()}.{ext}"
    with open(tmp_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    chunk_count = ingest_document(
        classroom_id,
        tmp_path,
        file.filename,
        uploaded_by=current_user.id,  # ← FIX: was missing, caused uploaded_by=0
        db=db,                         # ← FIX: pass session so service doesn't create its own
    )
    os.remove(tmp_path)

    doc = ClassroomDocument(
        classroom_id=classroom_id,
        uploaded_by=current_user.id,
        filename=f"{classroom_id}/{file.filename}",
        original_name=file.filename,
        file_type=ext,
        status="ready",
        chunk_count=chunk_count
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
    if current_user.role == "student":
        membership = db.query(ClassroomMember).filter(
            ClassroomMember.classroom_id == classroom_id,
            ClassroomMember.student_id == current_user.id
        ).first()
        if not membership:
            raise HTTPException(403, "Not enrolled in this classroom")
    elif current_user.role == "teacher" and classroom.teacher_id != current_user.id:
        raise HTTPException(403, "You do not own this classroom")
    docs = db.query(ClassroomDocument).filter(
        ClassroomDocument.classroom_id == classroom_id
    ).order_by(ClassroomDocument.created_at.desc()).all()
    return [
        {
            "id": d.id,
            "original_name": d.original_name,
            "file_type": d.file_type,
            "status": d.status,
            "chunk_count": d.chunk_count,
            "created_at": d.created_at
        }
        for d in docs
    ]


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


# ---------------------------------------------------------------------------
# NEW: DB-backed file endpoints  (/classrooms/{id}/files/...)
# ---------------------------------------------------------------------------

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
}


@router.post("/{classroom_id}/files/upload")
async def upload_file(
    classroom_id: int,
    file: UploadFile = File(...),
    section_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Teacher uploads a document. Bytes stored in DB; chunks + embeddings indexed."""
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(404, "Classroom not found")
    if current_user.role not in ["admin"] and classroom.teacher_id != current_user.id:
        raise HTTPException(403, "Only the classroom teacher can upload files")

    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(415, "Unsupported file type. Use PDF, DOCX, or TXT/MD.")

    # Validate section belongs to this classroom (if provided)
    if section_id is not None:
        section = db.query(ClassroomSection).filter(
            ClassroomSection.id == section_id,
            ClassroomSection.classroom_id == classroom_id,
        ).first()
        if not section:
            raise HTTPException(404, "Section not found in this classroom")

    raw_bytes = await file.read()

    try:
        file_id = upload_and_index(
            classroom_id=classroom_id,
            filename=file.filename,
            mime_type=file.content_type,
            raw_bytes=raw_bytes,
            uploaded_by=current_user.id,
            db=db,
            section_id=section_id,
        )
        # Verify chunks were created
        chunk_count = db.query(ClassroomChunk).filter(ClassroomChunk.file_id == file_id).count()
        print(f"✅ File uploaded: {file.filename} (ID={file_id}), chunks created: {chunk_count}")
    except ValueError as exc:
        print(f"❌ Upload failed: {str(exc)}")
        raise HTTPException(413, str(exc))

    return {"file_id": file_id, "filename": file.filename, "status": "indexed"}


@router.get("/{classroom_id}/files", response_model=List[FileMetaResponse])
def list_files(
    classroom_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return file metadata list (no binary data)."""
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(404, "Classroom not found")

    # Both teacher and enrolled students can list files
    if current_user.role == "student":
        membership = db.query(ClassroomMember).filter(
            ClassroomMember.classroom_id == classroom_id,
            ClassroomMember.student_id == current_user.id,
        ).first()
        if not membership:
            raise HTTPException(403, "Not enrolled in this classroom")

    files = (
        db.query(ClassroomFile)
        .filter(ClassroomFile.classroom_id == classroom_id)
        .order_by(ClassroomFile.uploaded_at.desc())
        .all()
    )
    return [
        FileMetaResponse(
            id=f.id,
            filename=f.filename,
            mime_type=f.mime_type,
            uploaded_at=f.uploaded_at.isoformat() if f.uploaded_at else "",
            section_id=f.section_id,
        )
        for f in files
    ]


@router.get("/test-view/{classroom_id}/{file_id}")
def test_view_endpoint(
    classroom_id: int,
    file_id: int,
    current_user: User = Depends(get_current_user),
):
    """Test endpoint to verify routing."""
    return {
        "test": "success",
        "classroom_id": classroom_id,
        "file_id": file_id,
        "user": current_user.email,
    }


@router.get("/{classroom_id}/files/{file_id}/view")
def view_file(
    classroom_id: int,
    file_id: int,
    token: str = None,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """Stream file bytes back to client for inline viewing.
    
    Supports authentication via:
    - Authorization header (Bearer token)
    - Query parameter ?token=xxx (for iframe embedding)
    """
    from routers.auth import verify_token
    
    # Try to authenticate from header or query param
    current_user = None
    try:
        if authorization:
            auth_token = authorization.replace("Bearer ", "").replace("bearer ", "")
            payload = verify_token(auth_token)
            current_user = db.query(User).filter(User.id == payload["user_id"]).first()
        elif token:
            payload = verify_token(token)
            current_user = db.query(User).filter(User.id == payload["user_id"]).first()
    except Exception as e:
        print(f"❌ [VIEW_FILE] Auth failed: {e}")
        raise HTTPException(401, "Authentication required")
    
    if not current_user:
        raise HTTPException(401, "Authentication required")
    
    # Get file
    f = (
        db.query(ClassroomFile)
        .filter(ClassroomFile.id == file_id, ClassroomFile.classroom_id == classroom_id)
        .first()
    )
    if not f:
        raise HTTPException(404, "File not found")

    return Response(
        content=f.file_data,
        media_type=f.mime_type,
        headers={"Content-Disposition": f'inline; filename="{f.filename}"'},
    )


@router.get("/{classroom_id}/files/{file_id}/download")
def download_file(
    classroom_id: int,
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stream file bytes back to client."""
    f = (
        db.query(ClassroomFile)
        .filter(ClassroomFile.id == file_id, ClassroomFile.classroom_id == classroom_id)
        .first()
    )
    if not f:
        raise HTTPException(404, "File not found")

    return Response(
        content=f.file_data,
        media_type=f.mime_type,
        headers={"Content-Disposition": f'attachment; filename="{f.filename}"'},
    )


@router.delete("/{classroom_id}/files/{file_id}")
def delete_file(
    classroom_id: int,
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Teacher deletes a file. Chunks are cascade-deleted."""
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(404, "Classroom not found")
    if current_user.role not in ["admin"] and classroom.teacher_id != current_user.id:
        raise HTTPException(403, "Forbidden")

    f = (
        db.query(ClassroomFile)
        .filter(ClassroomFile.id == file_id, ClassroomFile.classroom_id == classroom_id)
        .first()
    )
    if not f:
        raise HTTPException(404, "File not found")

    delete_classroom_file(file_id, classroom_id, db)
    return {"status": "deleted", "file_id": file_id}


# ---------------------------------------------------------------------------
# Section management endpoints
# ---------------------------------------------------------------------------

def _verify_teacher_access(classroom_id: int, current_user: User, db: Session) -> "Classroom":
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(404, "Classroom not found")
    if current_user.role not in ["admin"] and classroom.teacher_id != current_user.id:
        raise HTTPException(403, "Forbidden")
    return classroom


def _verify_classroom_access(classroom_id: int, current_user: User, db: Session) -> "Classroom":
    """Allow teacher/admin OR enrolled student."""
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(404, "Classroom not found")
    if current_user.role == "student":
        membership = db.query(ClassroomMember).filter(
            ClassroomMember.classroom_id == classroom_id,
            ClassroomMember.student_id == current_user.id,
        ).first()
        if not membership:
            raise HTTPException(403, "Not enrolled in this classroom")
    elif current_user.role == "teacher" and classroom.teacher_id != current_user.id:
        raise HTTPException(403, "You do not own this classroom")
    return classroom


@router.post("/{classroom_id}/sections", response_model=SectionResponse, status_code=status.HTTP_201_CREATED)
def create_section(
    classroom_id: int,
    data: SectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_teacher_access(classroom_id, current_user, db)
    if not data.name.strip():
        raise HTTPException(400, "Section name cannot be empty")
    section = ClassroomSection(
        classroom_id=classroom_id,
        name=data.name.strip(),
        description=data.description,
        order=data.order,
    )
    db.add(section)
    db.commit()
    db.refresh(section)
    section.files = []  # new section has no files yet
    return section


@router.get("/{classroom_id}/sections", response_model=List[SectionResponse])
def list_sections(
    classroom_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all sections for a classroom, each with their list of file metadata.
    An extra synthetic entry with id=None is appended for unsectioned files.
    """
    _verify_classroom_access(classroom_id, current_user, db)

    sections = (
        db.query(ClassroomSection)
        .filter(ClassroomSection.classroom_id == classroom_id)
        .order_by(ClassroomSection.order, ClassroomSection.created_at)
        .all()
    )

    all_files = (
        db.query(ClassroomFile)
        .filter(ClassroomFile.classroom_id == classroom_id)
        .order_by(ClassroomFile.uploaded_at.desc())
        .all()
    )

    # Build a lookup of section_id → files
    files_by_section: Dict[Optional[int], List] = {}
    for f in all_files:
        key = f.section_id
        files_by_section.setdefault(key, [])
        files_by_section[key].append(
            FileMetaResponse(
                id=f.id,
                filename=f.filename,
                mime_type=f.mime_type,
                uploaded_at=f.uploaded_at.isoformat() if f.uploaded_at else "",
                section_id=f.section_id,
            )
        )

    result = []
    for s in sections:
        s.files = files_by_section.get(s.id, [])
        result.append(s)

    # Append unsectioned virtual entry (id=None) only if there are unsectioned files
    unsectioned = files_by_section.get(None, [])
    if unsectioned:
        result.append(SectionResponse(
            id=0,           # 0 signals "unsectioned" to the frontend
            classroom_id=classroom_id,
            name="Unsectioned",
            description=None,
            order=9999,
            created_at=datetime.utcnow(),
            files=unsectioned,
        ))

    return result


@router.patch("/{classroom_id}/sections/{section_id}", response_model=SectionResponse)
def rename_section(
    classroom_id: int,
    section_id: int,
    data: SectionRename,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_teacher_access(classroom_id, current_user, db)
    if not data.name.strip():
        raise HTTPException(400, "Section name cannot be empty")
    section = db.query(ClassroomSection).filter(
        ClassroomSection.id == section_id,
        ClassroomSection.classroom_id == classroom_id,
    ).first()
    if not section:
        raise HTTPException(404, "Section not found")
    section.name = data.name.strip()
    db.commit()
    db.refresh(section)
    section.files = []
    return section


@router.delete("/{classroom_id}/sections/{section_id}", status_code=status.HTTP_200_OK)
def delete_section(
    classroom_id: int,
    section_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a section. Files in it become unsectioned (section_id → NULL)."""
    _verify_teacher_access(classroom_id, current_user, db)
    section = db.query(ClassroomSection).filter(
        ClassroomSection.id == section_id,
        ClassroomSection.classroom_id == classroom_id,
    ).first()
    if not section:
        raise HTTPException(404, "Section not found")
    # Detach files from section before deleting (ON DELETE SET NULL handles it at DB level)
    db.delete(section)
    db.commit()
    return {"status": "deleted", "section_id": section_id}


@router.patch("/{classroom_id}/files/{file_id}/section")
def move_file_to_section(
    classroom_id: int,
    file_id: int,
    data: MoveFileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Move a file to a different section (or make it unsectioned)."""
    _verify_teacher_access(classroom_id, current_user, db)
    f = db.query(ClassroomFile).filter(
        ClassroomFile.id == file_id,
        ClassroomFile.classroom_id == classroom_id,
    ).first()
    if not f:
        raise HTTPException(404, "File not found")
    if data.section_id is not None:
        section = db.query(ClassroomSection).filter(
            ClassroomSection.id == data.section_id,
            ClassroomSection.classroom_id == classroom_id,
        ).first()
        if not section:
            raise HTTPException(404, "Section not found")
    f.section_id = data.section_id
    db.commit()
    return {"status": "moved", "file_id": file_id, "section_id": data.section_id}


@router.get("/{classroom_id}/rag-status")
def get_rag_status(
    classroom_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Debug endpoint: Check RAG indexing status for a classroom."""
    from db_models import ClassroomFile, ClassroomChunk
    
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(404, "Classroom not found")
    
    # Verify access
    if current_user.role == "student":
        membership = db.query(ClassroomMember).filter(
            ClassroomMember.classroom_id == classroom_id,
            ClassroomMember.student_id == current_user.id,
        ).first()
        if not membership and current_user.role != "admin":
            raise HTTPException(403, "Not enrolled")
    
    files = db.query(ClassroomFile).filter(ClassroomFile.classroom_id == classroom_id).all()
    total_chunks = db.query(ClassroomChunk).filter(ClassroomChunk.classroom_id == classroom_id).count()
    
    file_statuses = []
    for f in files:
        chunk_count = db.query(ClassroomChunk).filter(ClassroomChunk.file_id == f.id).count()
        file_statuses.append({
            "file_id": f.id,
            "filename": f.filename,
            "uploaded_at": f.uploaded_at.isoformat() if f.uploaded_at else None,
            "chunk_count": chunk_count,
        })
    
    return {
        "classroom_id": classroom_id,
        "total_files": len(files),
        "total_chunks": total_chunks,
        "files": file_statuses,
        "rag_ready": total_chunks > 0,
    }


@router.post("/{classroom_id}/ask")
async def ask_classroom(
    classroom_id: int,
    body: ClassroomAskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Students ask a question scoped to this classroom's uploaded documents.
    Falls back gracefully if no documents are uploaded yet.
    """
    from services.classroom_rag import search_classroom_context
    from models import HKBULLM
    from core.config import API_KEY, BASE_URL, FAISS_MODEL_NAME, FAISS_API_VERSION

    context_chunks = search_classroom_context(
        classroom_id=classroom_id,
        query=body.question,
        db=db,
        top_k=5,
    )

    if not context_chunks:
        context_str = ""
        system_note = "No classroom documents are available yet. Answer from general Java knowledge."
    else:
        context_str = "\n\n---\n\n".join(context_chunks)
        system_note = "Use the provided classroom document excerpts to answer the question."

    prompt = (
        f"You are a Java programming tutor. {system_note}\n\n"
        + (f"CLASSROOM CONTEXT:\n{context_str}\n\n" if context_str else "")
        + f"STUDENT QUESTION: {body.question}\n\n"
        + "Provide a clear, educational answer. If referencing classroom material, cite it."
    )

    llm = HKBULLM(
        api_key=API_KEY,
        base_url=BASE_URL,
        model=FAISS_MODEL_NAME,
        api_version=FAISS_API_VERSION,
        max_tokens=1024,
    )
    answer = llm(prompt)

    return {
        "answer": answer,
        "has_context": len(context_chunks) > 0,
        "sources_count": len(context_chunks),
    }


# ---------------------------------------------------------------------------
# LLM helper (no circular import — lives here, mirrors call_llm_json in rag.py)
# ---------------------------------------------------------------------------

async def _call_llm_json_for_classroom(messages: List[Dict], temperature: float = 0.4, max_tokens: int = 3000, timeout: int = 120) -> dict:
    from core.config import API_KEY, BASE_URL, FAISS_MODEL_NAME, FAISS_API_VERSION
    api_url = f"{BASE_URL}/deployments/{FAISS_MODEL_NAME}/chat/completions?api-version={FAISS_API_VERSION}"
    headers_map = {"Content-Type": "application/json", "api-key": API_KEY}
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            api_url,
            headers=headers_map,
            json={
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "response_format": {"type": "json_object"},
            },
        )
        response.raise_for_status()
        raw = response.json()["choices"][0]["message"]["content"]
        raw = raw.replace("```json", "").replace("```", "").strip()
        return json.loads(raw)


# ---------------------------------------------------------------------------
# Quiz endpoints
# ---------------------------------------------------------------------------

@router.post("/{classroom_id}/quizzes/generate")
async def generate_classroom_quiz_questions(
    classroom_id: int,
    data: GenerateClassroomQuizRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate MCQ draft questions using classroom RAG context. Returns questions for teacher preview — nothing is saved yet."""
    _verify_teacher_access(classroom_id, current_user, db)

    if not data.topic_prompt.strip():
        raise HTTPException(400, "topic_prompt cannot be empty")

    num_q = max(1, min(data.num_questions, 20))

    # Choose context source: specific files (direct chunk fetch) or global RAG search
    if data.file_ids:
        # Validate all file_ids belong to this classroom
        valid_ids = [
            f.id for f in db.query(ClassroomFile)
                           .filter(ClassroomFile.classroom_id == classroom_id,
                                   ClassroomFile.id.in_(data.file_ids))
                           .all()
        ]
        if not valid_ids:
            raise HTTPException(404, "None of the selected files were found in this classroom.")
        context_chunks_raw = get_chunks_for_files(classroom_id, valid_ids, db)
    else:
        context_chunks_raw = search_classroom_context(
            classroom_id=classroom_id,
            query=data.topic_prompt,
            db=db,
            top_k=10,
        )

    if not context_chunks_raw:
        raise HTTPException(400, "No classroom documents found. Upload documents first, then generate a quiz.")

    # context chunks are dicts with "text" key
    texts = [c["text"] if isinstance(c, dict) else str(c) for c in context_chunks_raw]
    context_str = "\n\n---\n\n".join(texts)
    if len(context_str) > 7000:
        context_str = context_str[:7000] + "\n...[context truncated]"

    id_prefix = f"cq{classroom_id}_{int(time.time())}_"

    prompt = (
        f"You are an educational quiz generator. A teacher wants to create a quiz based on classroom materials.\n\n"
        f"CLASSROOM MATERIAL:\n{context_str}\n\n"
        f"QUIZ TOPIC: {data.topic_prompt}\n\n"
        f"Generate exactly {num_q} multiple-choice questions based strictly on the classroom material above.\n"
        f"Each question MUST:\n"
        f"- Test understanding of the topic: \"{data.topic_prompt}\"\n"
        f"- Be answerable from the classroom material above\n"
        f"- Have exactly 4 answer options (A, B, C, D)\n"
        f"- Have EXACTLY ONE correct answer (correct_index is 0-based)\n"
        f"- Include a brief explanation for the correct answer\n\n"
        f"Respond ONLY with a JSON object in this exact format:\n"
        f'{{"questions": [{{"id": "{id_prefix}1", "question": "...", "options": ["A", "B", "C", "D"], "correct_index": 0, "explanation": "..."}}]}}'
    )

    try:
        result = await _call_llm_json_for_classroom(
            messages=[
                {"role": "system", "content": "You are an expert quiz generator. Respond with valid JSON only."},
                {"role": "user", "content": prompt},
            ]
        )
    except Exception as exc:
        raise HTTPException(502, f"LLM request failed: {str(exc)}")

    questions = result.get("questions", [])
    if not questions:
        raise HTTPException(500, "LLM returned no questions. Please try again with a different prompt.")

    print(f"✅ Generated {len(questions)} questions for classroom {classroom_id}, topic: {data.topic_prompt}")
    return {"questions": questions, "context_chunks_used": len(context_chunks_raw)}


@router.post("/{classroom_id}/quizzes", response_model=ClassroomQuizResponse, status_code=status.HTTP_201_CREATED)
def save_classroom_quiz(
    classroom_id: int,
    data: SaveClassroomQuizRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save a quiz (draft or published) for a classroom."""
    _verify_teacher_access(classroom_id, current_user, db)

    if not data.title.strip():
        raise HTTPException(400, "Quiz title cannot be empty")
    if not data.questions:
        raise HTTPException(400, "Quiz must have at least one question")
    if data.status not in ("draft", "published"):
        raise HTTPException(400, "status must be 'draft' or 'published'")

    if data.section_id is not None:
        section = db.query(ClassroomSection).filter(
            ClassroomSection.id == data.section_id,
            ClassroomSection.classroom_id == classroom_id,
        ).first()
        if not section:
            raise HTTPException(404, "Section not found")

    quiz = ClassroomQuiz(
        classroom_id=classroom_id,
        section_id=data.section_id,
        title=data.title.strip(),
        topic_prompt=data.topic_prompt,
        questions=data.questions,
        status=data.status,
        created_by=current_user.id,
    )
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return quiz


@router.get("/{classroom_id}/quizzes", response_model=List[ClassroomQuizResponse])
def list_classroom_quizzes(
    classroom_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List quizzes. Teachers see all (draft + published); students see published only."""
    classroom = _verify_classroom_access(classroom_id, current_user, db)

    query = db.query(ClassroomQuiz).filter(ClassroomQuiz.classroom_id == classroom_id)
    if current_user.role == "student":
        query = query.filter(ClassroomQuiz.status == "published")

    return query.order_by(ClassroomQuiz.created_at.desc()).all()


@router.get("/{classroom_id}/quizzes/{quiz_id}", response_model=ClassroomQuizResponse)
def get_classroom_quiz(
    classroom_id: int,
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_classroom_access(classroom_id, current_user, db)
    quiz = db.query(ClassroomQuiz).filter(
        ClassroomQuiz.id == quiz_id,
        ClassroomQuiz.classroom_id == classroom_id,
    ).first()
    if not quiz:
        raise HTTPException(404, "Quiz not found")
    if current_user.role == "student" and quiz.status != "published":
        raise HTTPException(403, "This quiz is not published yet")
    return quiz


@router.patch("/{classroom_id}/quizzes/{quiz_id}", response_model=ClassroomQuizResponse)
def update_classroom_quiz(
    classroom_id: int,
    quiz_id: int,
    data: UpdateClassroomQuizRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Edit quiz title, questions, section, or status (publish/unpublish)."""
    _verify_teacher_access(classroom_id, current_user, db)
    quiz = db.query(ClassroomQuiz).filter(
        ClassroomQuiz.id == quiz_id,
        ClassroomQuiz.classroom_id == classroom_id,
    ).first()
    if not quiz:
        raise HTTPException(404, "Quiz not found")

    if data.title is not None:
        if not data.title.strip():
            raise HTTPException(400, "Title cannot be empty")
        quiz.title = data.title.strip()
    if data.questions is not None:
        if not data.questions:
            raise HTTPException(400, "Quiz must have at least one question")
        quiz.questions = data.questions
    if data.status is not None:
        if data.status not in ("draft", "published"):
            raise HTTPException(400, "status must be 'draft' or 'published'")
        quiz.status = data.status
    if "section_id" in data.model_fields_set:
        if data.section_id is not None:
            section = db.query(ClassroomSection).filter(
                ClassroomSection.id == data.section_id,
                ClassroomSection.classroom_id == classroom_id,
            ).first()
            if not section:
                raise HTTPException(404, "Section not found")
        quiz.section_id = data.section_id

    quiz.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(quiz)
    return quiz


@router.delete("/{classroom_id}/quizzes/{quiz_id}", status_code=status.HTTP_200_OK)
def delete_classroom_quiz(
    classroom_id: int,
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_teacher_access(classroom_id, current_user, db)
    quiz = db.query(ClassroomQuiz).filter(
        ClassroomQuiz.id == quiz_id,
        ClassroomQuiz.classroom_id == classroom_id,
    ).first()
    if not quiz:
        raise HTTPException(404, "Quiz not found")
    db.delete(quiz)
    db.commit()
    return {"status": "deleted", "quiz_id": quiz_id}

