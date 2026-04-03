from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Response, Header, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional, Dict, Any
import random
import string
import shutil, uuid, os, time, json
import httpx

from database import get_db
from db_models import User, Classroom, ClassroomMember, UserProgress, SavedWork, ClassroomDocument, ClassroomFile, ClassroomChunk, ClassroomSection, ClassroomQuiz, ClassroomPracticalChallenge, ClassroomPracticalChallengeAttempt, ClassroomQuizAttempt, MaterialRead
from routers.auth import get_current_user, require_role, get_optional_user
from services.classroom_rag import (
    ingest_document, upload_and_index, delete_classroom_file,
    search_classroom_context, get_chunks_for_files,
)
from core.topic_mapping import SUBTOPIC_TO_MAIN_TOPIC, ENHANCED_SUBTOPIC_TO_MAIN_TOPIC, to_main_topic

router = APIRouter(prefix="/classrooms", tags=["Classroom"])

# Basic Java constants
_VALID_SUBTOPIC_IDS = set(SUBTOPIC_TO_MAIN_TOPIC.keys())
NUM_MAIN_TOPICS = len(set(SUBTOPIC_TO_MAIN_TOPIC.values()))  # 12
TOTAL_ACTIVITIES = len(_VALID_SUBTOPIC_IDS) + NUM_MAIN_TOPICS + NUM_MAIN_TOPICS  # 76

# Enhanced Java constants
_VALID_ENHANCED_SUBTOPIC_IDS = set(ENHANCED_SUBTOPIC_TO_MAIN_TOPIC.keys())
NUM_ENHANCED_MAIN_TOPICS = len(set(ENHANCED_SUBTOPIC_TO_MAIN_TOPIC.values()))  # 8
TOTAL_ENHANCED_ACTIVITIES = len(_VALID_ENHANCED_SUBTOPIC_IDS) + NUM_ENHANCED_MAIN_TOPICS + NUM_ENHANCED_MAIN_TOPICS

VALID_COURSES = {"basic", "enhanced"}


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
    category: Optional[str] = "Official Lessons"
    description: Optional[str] = None
    enrolled_courses: Optional[List[str]] = None


class ClassroomResponse(BaseModel):
    id: int
    name: str
    category: str
    description: Optional[str]
    class_code: str
    teacher_id: int
    enrolled_courses: Optional[List[str]] = None
    is_public: bool = False
    created_at: datetime
    member_count: int = 0

    class Config:
        from_attributes = True


class ClassroomUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    is_public: Optional[bool] = None


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


class CourseTopicStat(BaseModel):
    topic: str
    quiz_attempts: int
    quiz_avg_score: Optional[float]
    quiz_pass_rate: Optional[float]
    test_attempts: int
    test_avg_score: Optional[float]
    test_pass_rate: Optional[float]
    is_weak: bool


class StudentCourseProgress(BaseModel):
    student_id: int
    full_name: Optional[str]
    email: str
    completion_percentage: float
    completed_topics: int
    quizzes_attempted: int
    quizzes_passed: int
    avg_quiz_score: Optional[float]
    tests_attempted: int
    tests_passed: int
    avg_test_score: Optional[float]
    last_active: Optional[datetime]
    weak_topics: List[str]
    topic_stats: List[CourseTopicStat]


class CourseClassSummary(BaseModel):
    avg_completion_percentage: Optional[float]
    avg_quiz_score: Optional[float]
    avg_test_score: Optional[float]
    quiz_pass_rate: Optional[float]
    test_pass_rate: Optional[float]
    most_common_weak_topics: List[str]


class ClassroomCourseProgressAnalytics(BaseModel):
    classroom_id: Optional[int]
    classroom_name: str
    total_students: int
    class_summary: CourseClassSummary
    students: List[StudentCourseProgress]


class ClassroomCourseSummaryItem(BaseModel):
    classroom_id: int
    classroom_name: str
    total_students: int
    class_summary: CourseClassSummary


class StudentWorkItem(BaseModel):
    id: int
    work_type: str
    title: str
    topic_id: Optional[str]
    content: Optional[str]
    result_data: Optional[Any]
    created_at: datetime


class StudentWorkListResponse(BaseModel):
    student_id: int
    full_name: Optional[str]
    email: str
    items: List[StudentWorkItem]


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
    source: str = "classroom"             # 'classroom' | 'course' | 'both'
    course_path: Optional[str] = None     # 'basic_java' | 'enhanced_java' (used when source='course' or 'both')


class SaveClassroomQuizRequest(BaseModel):
    title: str
    topic_prompt: Optional[str] = None
    questions: List[dict]
    section_id: Optional[int] = None
    status: str = "draft"  # "draft" | "published"
    attempt_limit: Optional[int] = None  # max attempts per student (None = unlimited)


class UpdateClassroomQuizRequest(BaseModel):
    title: Optional[str] = None
    questions: Optional[List[dict]] = None
    section_id: Optional[int] = None
    status: Optional[str] = None
    attempt_limit: Optional[int] = None  # max attempts per student (None = unlimited)


class SubmitClassroomQuizAttemptRequest(BaseModel):
    """Student submits quiz attempt with answers and score"""
    score: float          # 0-100, percentage correct
    answers: Optional[dict] = None  # {question_id: selected_option_index, ...}


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


def _build_course_topic_stats(works: List[SavedWork]) -> List[CourseTopicStat]:
    topic_buckets: Dict[str, Dict[str, Any]] = {}
    for w in works:
        if w.work_type not in ("quiz", "test"):
            continue

        score = _score_of(w.result_data)
        topics = _topics_of(w)
        if not topics:
            continue

        for topic in topics:
            bucket = topic_buckets.setdefault(topic, {
                "quiz_attempts": 0,
                "quiz_scores": [],
                "test_attempts": 0,
                "test_scores": [],
            })

            if w.work_type == "quiz":
                bucket["quiz_attempts"] += 1
                if score is not None:
                    bucket["quiz_scores"].append(score)
            else:
                bucket["test_attempts"] += 1
                if score is not None:
                    bucket["test_scores"].append(score)

    stats: List[CourseTopicStat] = []
    for topic in sorted(topic_buckets.keys()):
        bucket = topic_buckets[topic]

        quiz_scores = bucket["quiz_scores"]
        test_scores = bucket["test_scores"]

        quiz_avg = round(sum(quiz_scores) / len(quiz_scores), 1) if quiz_scores else None
        test_avg = round(sum(test_scores) / len(test_scores), 1) if test_scores else None

        quiz_passed = sum(1 for s in quiz_scores if s >= 70)
        test_passed = sum(1 for s in test_scores if s >= 60)

        quiz_pass_rate = (
            round(quiz_passed / len(quiz_scores) * 100, 1) if quiz_scores else None
        )
        test_pass_rate = (
            round(test_passed / len(test_scores) * 100, 1) if test_scores else None
        )

        is_weak = (
            (quiz_avg is not None and quiz_avg < 70) or
            (test_avg is not None and test_avg < 60)
        )

        stats.append(CourseTopicStat(
            topic=topic,
            quiz_attempts=bucket["quiz_attempts"],
            quiz_avg_score=quiz_avg,
            quiz_pass_rate=quiz_pass_rate,
            test_attempts=bucket["test_attempts"],
            test_avg_score=test_avg,
            test_pass_rate=test_pass_rate,
            is_weak=is_weak,
        ))

    return stats


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
    normalized_category = (data.category or "Official Lessons").strip()
    if not normalized_category:
        normalized_category = "Official Lessons"

    # Validate enrolled_courses; default to ["basic"]
    valid_courses = [c for c in (data.enrolled_courses or []) if c in VALID_COURSES]
    if not valid_courses:
        valid_courses = ["basic"]

    classroom = Classroom(
        name=data.name,
        category=normalized_category[:100],
        description=data.description,
        class_code=code,
        teacher_id=current_user.id,
        enrolled_courses=valid_courses,
    )
    db.add(classroom)
    db.commit()
    db.refresh(classroom)
    return classroom


@router.get("/my", response_model=List[ClassroomResponse])
async def list_my_classrooms(
    search: Optional[str] = Query(None),
    category_filter: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin"))
):
    query = db.query(Classroom).filter(Classroom.teacher_id == current_user.id)
    if category_filter:
        query = query.filter(
            func.lower(Classroom.category) == category_filter.strip().lower()
        )
    if search:
        term = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(Classroom.name).like(term),
                func.lower(Classroom.category).like(term),
                func.lower(Classroom.description).like(term),
            )
        )
    return query.order_by(Classroom.created_at.desc()).all()


@router.get("/official/list", response_model=List[ClassroomResponse])
async def list_official_classrooms(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin"))
):
    """Return all classrooms owned by this teacher."""
    query = db.query(Classroom).filter(
        Classroom.teacher_id == current_user.id
    )
    return query.order_by(Classroom.created_at.desc()).all()


@router.patch("/{classroom_id}", response_model=ClassroomResponse)
async def update_classroom(
    classroom_id: int,
    data: ClassroomUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    if current_user.role == "teacher" and classroom.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not own this classroom")
    if data.name is not None:
        stripped = data.name.strip()
        if not stripped:
            raise HTTPException(status_code=400, detail="Name cannot be empty")
        classroom.name = stripped
    if data.category is not None:
        stripped = data.category.strip()
        if not stripped:
            raise HTTPException(status_code=400, detail="Category cannot be empty")
        classroom.category = stripped[:100]
    if data.description is not None:
        classroom.description = data.description.strip() or None
    if data.is_public is not None:
        classroom.is_public = data.is_public
    db.commit()
    db.refresh(classroom)
    return classroom


# ---------------------------------------------------------------------------
# Student-facing classroom endpoints (literal paths before dynamic ones)
# ---------------------------------------------------------------------------

@router.get("/public", response_model=List[ClassroomResponse])
async def list_public_classrooms(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """Return all public classrooms. Excludes already-joined ones for authenticated users."""
    member_count_sq = (
        db.query(func.count(ClassroomMember.id))
        .filter(ClassroomMember.classroom_id == Classroom.id)
        .correlate(Classroom)
        .scalar_subquery()
    )
    query = db.query(Classroom, member_count_sq.label("member_count")).filter(Classroom.is_public == True)  # noqa: E712
    if current_user:
        joined_ids = (
            db.query(ClassroomMember.classroom_id)
            .filter(ClassroomMember.student_id == current_user.id)
        )
        query = query.filter(Classroom.id.notin_(joined_ids))
    rows = query.order_by(Classroom.created_at.desc()).all()
    result = []
    for cls, count in rows:
        d = ClassroomResponse.model_validate(cls)
        d.member_count = count or 0
        result.append(d)
    return result


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


@router.get("/official-aggregate/course-progress", response_model=ClassroomCourseProgressAnalytics)
async def get_official_aggregate_course_progress(
    course_id: str = Query(default="basic"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin"))
):
    """Aggregate course-progress across all Official Lessons classrooms owned by this teacher."""
    if course_id not in VALID_COURSES:
        course_id = "basic"

    if course_id == "enhanced":
        valid_subtopics = _VALID_ENHANCED_SUBTOPIC_IDS
        num_main = NUM_ENHANCED_MAIN_TOPICS
        total_acts = TOTAL_ENHANCED_ACTIVITIES
        course_label = "Enhanced Java"
        subtopic_map = ENHANCED_SUBTOPIC_TO_MAIN_TOPIC
    else:
        valid_subtopics = _VALID_SUBTOPIC_IDS
        num_main = NUM_MAIN_TOPICS
        total_acts = TOTAL_ACTIVITIES
        course_label = "Basic Java"
        subtopic_map = SUBTOPIC_TO_MAIN_TOPIC

    official_classrooms = (
        db.query(Classroom)
        .filter(
            Classroom.teacher_id == current_user.id,
        )
        .all()
    )

    if not official_classrooms:
        return ClassroomCourseProgressAnalytics(
            classroom_id=None,
            classroom_name=course_label,
            total_students=0,
            class_summary=CourseClassSummary(
                avg_completion_percentage=None, avg_quiz_score=None, avg_test_score=None,
                quiz_pass_rate=None, test_pass_rate=None, most_common_weak_topics=[],
            ),
            students=[],
        )

    classroom_ids = [c.id for c in official_classrooms]
    raw_members = (
        db.query(ClassroomMember, User)
        .join(User, ClassroomMember.student_id == User.id)
        .filter(ClassroomMember.classroom_id.in_(classroom_ids))
        .all()
    )
    seen_ids: set = set()
    unique_members = []
    for member, student in raw_members:
        if student.id not in seen_ids:
            seen_ids.add(student.id)
            unique_members.append((member, student))

    students: List[StudentCourseProgress] = []
    all_completion_scores: List[float] = []
    all_quiz_scores: List[float] = []
    all_test_scores: List[float] = []
    total_quiz_attempts = 0
    total_quiz_passed = 0
    total_test_attempts = 0
    total_test_passed = 0
    weak_topic_freq: Dict[str, int] = {}

    for _, student in unique_members:
        progress = (
            db.query(UserProgress)
            .filter(UserProgress.user_id == student.id, UserProgress.course_id == course_id)
            .first()
        )
        works = (
            db.query(SavedWork)
            .filter(SavedWork.user_id == student.id)
            .order_by(SavedWork.created_at.desc())
            .all()
        )
        quiz_works = [w for w in works if w.work_type == "quiz" and any(t in valid_subtopics for t in _topics_of(w))]
        test_works = [w for w in works if w.work_type == "test" and any(t in valid_subtopics for t in _topics_of(w))]
        quiz_scores = [s for s in (_score_of(w.result_data) for w in quiz_works) if s is not None]
        test_scores = [s for s in (_score_of(w.result_data) for w in test_works) if s is not None]

        quizzes_attempted = len(quiz_works)
        quizzes_passed = sum(1 for s in quiz_scores if s >= 70)
        tests_attempted = len(test_works)
        tests_passed = sum(1 for s in test_scores if s >= 60)

        topic_stats = _build_course_topic_stats(quiz_works + test_works)
        weak_topics = [t.topic for t in topic_stats if t.is_weak]

        subtopics_read = len(set(progress.completed_topics or []) & valid_subtopics) if progress else 0
        passed_quiz_main = {
            subtopic_map.get(t, t)
            for w in quiz_works
            if (_score_of(w.result_data) or 0) >= 70
            for t in _topics_of(w)
        }
        passed_test_main = {
            subtopic_map.get(t, t)
            for w in test_works
            if (_score_of(w.result_data) or 0) >= 60
            for t in _topics_of(w)
        }
        completed_topics_count = subtopics_read
        completion_percentage = round(
            (subtopics_read + min(len(passed_quiz_main), num_main) + min(len(passed_test_main), num_main)) / total_acts * 100, 1
        ) if total_acts > 0 else 0.0

        sp = StudentCourseProgress(
            student_id=student.id,
            full_name=student.full_name,
            email=student.email,
            completion_percentage=completion_percentage,
            completed_topics=completed_topics_count,
            quizzes_attempted=quizzes_attempted,
            quizzes_passed=quizzes_passed,
            avg_quiz_score=round(sum(quiz_scores) / len(quiz_scores), 1) if quiz_scores else None,
            tests_attempted=tests_attempted,
            tests_passed=tests_passed,
            avg_test_score=round(sum(test_scores) / len(test_scores), 1) if test_scores else None,
            last_active=works[0].created_at if works else None,
            weak_topics=weak_topics,
            topic_stats=topic_stats,
        )
        students.append(sp)
        all_completion_scores.append(sp.completion_percentage)
        all_quiz_scores.extend(quiz_scores)
        all_test_scores.extend(test_scores)
        total_quiz_attempts += quizzes_attempted
        total_quiz_passed += quizzes_passed
        total_test_attempts += tests_attempted
        total_test_passed += tests_passed
        for topic in weak_topics:
            weak_topic_freq[topic] = weak_topic_freq.get(topic, 0) + 1

    class_summary = CourseClassSummary(
        avg_completion_percentage=round(sum(all_completion_scores) / len(all_completion_scores), 1) if all_completion_scores else None,
        avg_quiz_score=round(sum(all_quiz_scores) / len(all_quiz_scores), 1) if all_quiz_scores else None,
        avg_test_score=round(sum(all_test_scores) / len(all_test_scores), 1) if all_test_scores else None,
        quiz_pass_rate=round(total_quiz_passed / total_quiz_attempts * 100, 1) if total_quiz_attempts > 0 else None,
        test_pass_rate=round(total_test_passed / total_test_attempts * 100, 1) if total_test_attempts > 0 else None,
        most_common_weak_topics=sorted(weak_topic_freq, key=lambda x: -weak_topic_freq[x])[:5],
    )
    return ClassroomCourseProgressAnalytics(
        classroom_id=None,
        classroom_name=course_label,
        total_students=len(students),
        class_summary=class_summary,
        students=students,
    )


@router.get("/official-aggregate/by-classroom", response_model=List[ClassroomCourseSummaryItem])
async def get_official_aggregate_by_classroom(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin"))
):
    """Return a lightweight per-classroom summary for all classrooms owned by this teacher."""
    official_classrooms = (
        db.query(Classroom)
        .filter(
            Classroom.teacher_id == current_user.id,
        )
        .order_by(Classroom.name)
        .all()
    )

    result: List[ClassroomCourseSummaryItem] = []
    for classroom in official_classrooms:
        members = (
            db.query(ClassroomMember, User)
            .join(User, ClassroomMember.student_id == User.id)
            .filter(ClassroomMember.classroom_id == classroom.id)
            .all()
        )

        all_completion: List[float] = []
        all_quiz_scores: List[float] = []
        all_test_scores: List[float] = []
        total_quiz_attempts = 0
        total_quiz_passed = 0
        total_test_attempts = 0
        total_test_passed = 0
        weak_topic_freq: Dict[str, int] = {}

        for _, student in members:
            progress = db.query(UserProgress).filter(UserProgress.user_id == student.id).first()
            works = (
                db.query(SavedWork)
                .filter(SavedWork.user_id == student.id)
                .order_by(SavedWork.created_at.desc())
                .all()
            )
            quiz_works = [w for w in works if w.work_type == "quiz"]
            test_works = [w for w in works if w.work_type == "test"]
            quiz_scores = [s for s in (_score_of(w.result_data) for w in quiz_works) if s is not None]
            test_scores = [s for s in (_score_of(w.result_data) for w in test_works) if s is not None]

            quizzes_passed = sum(1 for s in quiz_scores if s >= 70)
            tests_passed = sum(1 for s in test_scores if s >= 60)

            topic_stats = _build_course_topic_stats(works)
            weak_topics = [t.topic for t in topic_stats if t.is_weak]

            subtopics_read = len(set(progress.completed_topics or []) & _VALID_SUBTOPIC_IDS) if progress else 0
            passed_quiz_main = {
                to_main_topic(t)
                for w in quiz_works
                if (_score_of(w.result_data) or 0) >= 70
                for t in _topics_of(w)
            }
            passed_test_main = {
                to_main_topic(t)
                for w in test_works
                if (_score_of(w.result_data) or 0) >= 60
                for t in _topics_of(w)
            }
            completion_percentage = round(
                (subtopics_read + min(len(passed_quiz_main), NUM_MAIN_TOPICS) + min(len(passed_test_main), NUM_MAIN_TOPICS)) / TOTAL_ACTIVITIES * 100, 1
            )

            all_completion.append(completion_percentage)
            all_quiz_scores.extend(quiz_scores)
            all_test_scores.extend(test_scores)
            total_quiz_attempts += len(quiz_works)
            total_quiz_passed += quizzes_passed
            total_test_attempts += len(test_works)
            total_test_passed += tests_passed
            for topic in weak_topics:
                weak_topic_freq[topic] = weak_topic_freq.get(topic, 0) + 1

        class_summary = CourseClassSummary(
            avg_completion_percentage=round(sum(all_completion) / len(all_completion), 1) if all_completion else None,
            avg_quiz_score=round(sum(all_quiz_scores) / len(all_quiz_scores), 1) if all_quiz_scores else None,
            avg_test_score=round(sum(all_test_scores) / len(all_test_scores), 1) if all_test_scores else None,
            quiz_pass_rate=round(total_quiz_passed / total_quiz_attempts * 100, 1) if total_quiz_attempts > 0 else None,
            test_pass_rate=round(total_test_passed / total_test_attempts * 100, 1) if total_test_attempts > 0 else None,
            most_common_weak_topics=sorted(weak_topic_freq, key=lambda x: -weak_topic_freq[x])[:5],
        )
        result.append(ClassroomCourseSummaryItem(
            classroom_id=classroom.id,
            classroom_name=classroom.name,
            total_students=len(members),
            class_summary=class_summary,
        ))

    return result


@router.get("/official-aggregate/students/{student_id}/work", response_model=StudentWorkListResponse)
async def get_official_aggregate_student_work(
    student_id: int,
    work_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin"))
):
    """Fetch a student's work for teachers via the aggregate official-classroom path."""
    official_classrooms = (
        db.query(Classroom)
        .filter(Classroom.teacher_id == current_user.id)
        .all()
    )
    if not official_classrooms:
        raise HTTPException(status_code=404, detail="No classrooms found")

    membership = db.query(ClassroomMember).filter(
        ClassroomMember.classroom_id.in_([c.id for c in official_classrooms]),
        ClassroomMember.student_id == student_id,
    ).first()
    if not membership:
        raise HTTPException(status_code=404, detail="Student not enrolled in any official classroom")

    student = db.query(User).filter(User.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if work_type and work_type not in ("playground", "quiz", "test"):
        raise HTTPException(status_code=400, detail="work_type must be one of: playground, quiz, test")

    query = db.query(SavedWork).filter(SavedWork.user_id == student_id)
    if work_type:
        query = query.filter(SavedWork.work_type == work_type)
    items = query.order_by(SavedWork.created_at.desc()).all()

    return StudentWorkListResponse(
        student_id=student.id,
        full_name=student.full_name,
        email=student.email,
        items=[
            StudentWorkItem(id=i.id, work_type=i.work_type, title=i.title, topic_id=i.topic_id,
                            content=i.content, result_data=i.result_data, created_at=i.created_at)
            for i in items
        ],
    )


@router.get("/{classroom_id}/course-progress", response_model=ClassroomCourseProgressAnalytics)
async def get_classroom_course_progress(
    classroom_id: int,
    course_id: str = Query(default="basic"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin"))
):
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    if current_user.role == "teacher" and classroom.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not own this classroom")

    if course_id not in VALID_COURSES:
        course_id = "basic"

    # Pick the right constants for the selected course
    if course_id == "enhanced":
        valid_subtopics = _VALID_ENHANCED_SUBTOPIC_IDS
        num_main = NUM_ENHANCED_MAIN_TOPICS
        total_acts = TOTAL_ENHANCED_ACTIVITIES
        course_label = "Enhanced Java"
        subtopic_map = ENHANCED_SUBTOPIC_TO_MAIN_TOPIC
    else:
        valid_subtopics = _VALID_SUBTOPIC_IDS
        num_main = NUM_MAIN_TOPICS
        total_acts = TOTAL_ACTIVITIES
        course_label = "Basic Java"
        subtopic_map = SUBTOPIC_TO_MAIN_TOPIC

    members = (
        db.query(ClassroomMember, User)
        .join(User, ClassroomMember.student_id == User.id)
        .filter(ClassroomMember.classroom_id == classroom_id)
        .all()
    )

    students: List[StudentCourseProgress] = []

    all_completion_scores: List[float] = []
    all_quiz_scores: List[float] = []
    all_test_scores: List[float] = []
    total_quiz_attempts = 0
    total_quiz_passed = 0
    total_test_attempts = 0
    total_test_passed = 0
    weak_topic_freq: Dict[str, int] = {}

    for _, student in members:
        progress = (
            db.query(UserProgress)
            .filter(UserProgress.user_id == student.id, UserProgress.course_id == course_id)
            .first()
        )
        works = (
            db.query(SavedWork)
            .filter(SavedWork.user_id == student.id)
            .order_by(SavedWork.created_at.desc())
            .all()
        )

        quiz_works = [w for w in works if w.work_type == "quiz" and any(t in valid_subtopics for t in _topics_of(w))]
        test_works = [w for w in works if w.work_type == "test" and any(t in valid_subtopics for t in _topics_of(w))]

        quiz_scores = [s for s in (_score_of(w.result_data) for w in quiz_works) if s is not None]
        test_scores = [s for s in (_score_of(w.result_data) for w in test_works) if s is not None]

        quizzes_attempted = len(quiz_works)
        quizzes_passed = sum(1 for s in quiz_scores if s >= 70)
        tests_attempted = len(test_works)
        tests_passed = sum(1 for s in test_scores if s >= 60)

        topic_stats = _build_course_topic_stats(quiz_works + test_works)
        weak_topics = [t.topic for t in topic_stats if t.is_weak]

        subtopics_read = len(set(progress.completed_topics or []) & valid_subtopics) if progress else 0
        passed_quiz_main = {
            subtopic_map.get(t, t)
            for w in quiz_works
            if (_score_of(w.result_data) or 0) >= 70
            for t in _topics_of(w)
        }
        passed_test_main = {
            subtopic_map.get(t, t)
            for w in test_works
            if (_score_of(w.result_data) or 0) >= 60
            for t in _topics_of(w)
        }
        completed_topics_count = subtopics_read
        completion_percentage = round(
            (subtopics_read + min(len(passed_quiz_main), num_main) + min(len(passed_test_main), num_main)) / total_acts * 100, 1
        ) if total_acts > 0 else 0.0

        student_progress = StudentCourseProgress(
            student_id=student.id,
            full_name=student.full_name,
            email=student.email,
            completion_percentage=round(completion_percentage, 1),
            completed_topics=completed_topics_count,
            quizzes_attempted=quizzes_attempted,
            quizzes_passed=quizzes_passed,
            avg_quiz_score=round(sum(quiz_scores) / len(quiz_scores), 1) if quiz_scores else None,
            tests_attempted=tests_attempted,
            tests_passed=tests_passed,
            avg_test_score=round(sum(test_scores) / len(test_scores), 1) if test_scores else None,
            last_active=works[0].created_at if works else None,
            weak_topics=weak_topics,
            topic_stats=topic_stats,
        )

        students.append(student_progress)
        all_completion_scores.append(student_progress.completion_percentage)

        all_quiz_scores.extend(quiz_scores)
        all_test_scores.extend(test_scores)

        total_quiz_attempts += quizzes_attempted
        total_quiz_passed += quizzes_passed
        total_test_attempts += tests_attempted
        total_test_passed += tests_passed

        for topic in weak_topics:
            weak_topic_freq[topic] = weak_topic_freq.get(topic, 0) + 1

    class_summary = CourseClassSummary(
        avg_completion_percentage=round(sum(all_completion_scores) / len(all_completion_scores), 1) if all_completion_scores else None,
        avg_quiz_score=round(sum(all_quiz_scores) / len(all_quiz_scores), 1) if all_quiz_scores else None,
        avg_test_score=round(sum(all_test_scores) / len(all_test_scores), 1) if all_test_scores else None,
        quiz_pass_rate=round(total_quiz_passed / total_quiz_attempts * 100, 1) if total_quiz_attempts > 0 else None,
        test_pass_rate=round(total_test_passed / total_test_attempts * 100, 1) if total_test_attempts > 0 else None,
        most_common_weak_topics=sorted(weak_topic_freq, key=lambda x: -weak_topic_freq[x])[:5],
    )

    return ClassroomCourseProgressAnalytics(
        classroom_id=classroom.id,
        classroom_name=classroom.name,
        total_students=len(students),
        class_summary=class_summary,
        students=students,
    )


@router.get("/{classroom_id}/students/{student_id}/work", response_model=StudentWorkListResponse)
async def get_student_work_for_teacher(
    classroom_id: int,
    student_id: int,
    work_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin"))
):
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    if current_user.role == "teacher" and classroom.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not own this classroom")

    membership = db.query(ClassroomMember).filter(
        ClassroomMember.classroom_id == classroom_id,
        ClassroomMember.student_id == student_id,
    ).first()
    if not membership:
        raise HTTPException(status_code=404, detail="Student is not enrolled in this classroom")

    if work_type and work_type not in ("playground", "quiz", "test"):
        raise HTTPException(status_code=400, detail="work_type must be one of: playground, quiz, test")

    student = db.query(User).filter(User.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    query = db.query(SavedWork).filter(SavedWork.user_id == student_id)
    if work_type:
        query = query.filter(SavedWork.work_type == work_type)

    items = query.order_by(SavedWork.created_at.desc()).all()

    return StudentWorkListResponse(
        student_id=student.id,
        full_name=student.full_name,
        email=student.email,
        items=[
            StudentWorkItem(
                id=i.id,
                work_type=i.work_type,
                title=i.title,
                topic_id=i.topic_id,
                content=i.content,
                result_data=i.result_data,
                created_at=i.created_at,
            )
            for i in items
        ],
    )


# ---------------------------------------------------------------------------
# Student endpoints
# ---------------------------------------------------------------------------

@router.get("/public", response_model=List[ClassroomResponse])
async def list_public_classrooms(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """Return all public classrooms. Excludes already-joined ones for authenticated users."""
    member_count_sq = (
        db.query(func.count(ClassroomMember.id))
        .filter(ClassroomMember.classroom_id == Classroom.id)
        .correlate(Classroom)
        .scalar_subquery()
    )
    query = db.query(Classroom, member_count_sq.label("member_count")).filter(Classroom.is_public == True)  # noqa: E712
    if current_user:
        joined_ids = (
            db.query(ClassroomMember.classroom_id)
            .filter(ClassroomMember.student_id == current_user.id)
        )
        query = query.filter(Classroom.id.notin_(joined_ids))
    rows = query.order_by(Classroom.created_at.desc()).all()
    result = []
    for cls, count in rows:
        d = ClassroomResponse.model_validate(cls)
        d.member_count = count or 0
        result.append(d)
    return result


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
    """Generate MCQ draft questions using classroom RAG context, course content, or both. Returns questions for teacher preview — nothing is saved yet."""
    _verify_teacher_access(classroom_id, current_user, db)

    if not data.topic_prompt.strip():
        raise HTTPException(400, "topic_prompt cannot be empty")

    if data.source not in ("classroom", "course", "both"):
        raise HTTPException(400, "source must be 'classroom', 'course', or 'both'")

    num_q = max(1, min(data.num_questions, 20))
    context_chunks_raw = []

    # Gather from course and/or classroom according to data.source
    course_chunks = []
    classroom_chunks = []
    context_source_label = ""

    if data.source in ("course", "both"):
        valid_paths = {"basic_java", "enhanced_java"}
        course_path = data.course_path or "basic_java"
        if course_path not in valid_paths:
            raise HTTPException(400, f"course_path must be one of {valid_paths}")
        try:
            from routers.rag import get_retriever
            retriever = await get_retriever()
            docs = retriever.invoke(data.topic_prompt)
            course_chunks = [{"text": d.page_content} for d in docs]
            print(f"✓ Retrieved {len(course_chunks)} chunks from course content ({course_path})")
        except Exception as exc:
            if data.source == "course":
                raise HTTPException(503, f"Course content unavailable: {str(exc)}")
            print(f"⚠️ Course content unavailable (proceeding with classroom only): {str(exc)}")
            course_chunks = []

    if data.source in ("classroom", "both"):
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
            classroom_chunks = get_chunks_for_files(classroom_id, valid_ids, db)
            print(f"✓ Retrieved {len(classroom_chunks)} chunks from {len(valid_ids)} selected classroom files")
        else:
            classroom_chunks = search_classroom_context(
                classroom_id=classroom_id,
                query=data.topic_prompt,
                db=db,
                top_k=10,
            )
            print(f"✓ Retrieved {len(classroom_chunks)} chunks from classroom RAG search")
        
        if not classroom_chunks and data.source == "classroom":
            raise HTTPException(400, "No classroom documents found. Upload documents first, then generate an exercise.")

    # Merge and deduplicate by text
    merged = []
    seen = set()
    for c in (course_chunks + classroom_chunks):
        t = (c["text"] if isinstance(c, dict) else str(c)).strip()
        if not t or t in seen:
            continue
        seen.add(t)
        merged.append(c)

    if not merged:
        raise HTTPException(400, f"No context found from selected sources ({data.source}). Try uploading documents or selecting a different course.")

    context_chunks_raw = merged

    # Build context string
    texts = [c["text"] if isinstance(c, dict) else str(c) for c in context_chunks_raw]
    context_str = "\n\n---\n\n".join(texts)
    if len(context_str) > 7000:
        context_str = context_str[:7000] + "\n...[context truncated]"

    # Build source label for prompt
    if data.source == "both":
        context_source_label = "classroom materials and course content"
    elif data.source == "course":
        context_source_label = f"{(data.course_path or 'basic_java').replace('_', ' ').title()} course content"
    else:
        context_source_label = "classroom materials"

    id_prefix = f"cq{classroom_id}_{int(time.time())}_"

    prompt = (
        f"You are an educational exercise generator. A teacher wants to create a Java programming exercise based on {context_source_label}.\n\n"
        f"REFERENCE MATERIAL:\n{context_str}\n\n"
        f"TOPIC: {data.topic_prompt}\n\n"
        f"Generate exactly {num_q} multiple-choice questions based on the reference material above.\n"
        f"Each question MUST:\n"
        f"- Test understanding of the topic: \"{data.topic_prompt}\"\n"
        f"- Be answerable from the reference material above\n"
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

    print(f"✅ Generated {len(questions)} questions for classroom {classroom_id}, topic: {data.topic_prompt}, source: {data.source}")
    return {"questions": questions, "context_chunks_used": len(context_chunks_raw), "source": data.source}


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
        attempt_limit=data.attempt_limit,
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
    if data.attempt_limit is not None:
        quiz.attempt_limit = data.attempt_limit

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


@router.post("/{classroom_id}/quizzes/{quiz_id}/submit")
def submit_classroom_quiz_attempt(
    classroom_id: int,
    quiz_id: int,
    data: SubmitClassroomQuizAttemptRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit a quiz attempt with score and answers. Students submit after completing a quiz."""
    # Verify student is in classroom
    _verify_classroom_access(classroom_id, current_user, db)
    if current_user.role != "student":
        raise HTTPException(403, "Only students can submit quiz attempts")
    
    # Verify quiz exists and is published
    quiz = db.query(ClassroomQuiz).filter(
        ClassroomQuiz.id == quiz_id,
        ClassroomQuiz.classroom_id == classroom_id,
        ClassroomQuiz.status == "published",
    ).first()
    if not quiz:
        raise HTTPException(404, "Quiz not found or not yet published")
    
    # Create and save attempt
    from db_models import ClassroomQuizAttempt
    attempt = ClassroomQuizAttempt(
        quiz_id=quiz_id,
        student_id=current_user.id,
        score=data.score,
        answers=data.answers,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    
    return {
        "status": "submitted",
        "attempt_id": attempt.id,
        "quiz_id": quiz_id,
        "score": attempt.score,
        "submitted_at": attempt.submitted_at.isoformat(),
    }


@router.get("/{classroom_id}/quizzes/{quiz_id}/student-results")
def get_classroom_quiz_student_results(
    classroom_id: int,
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get quiz attempt results for all students (teacher view) or current student's results (student view)."""
    # Verify access
    member = db.query(ClassroomMember).filter(
        ClassroomMember.classroom_id == classroom_id,
        ClassroomMember.student_id == current_user.id,
    ).first()
    is_student = bool(member)
    is_teacher = current_user.role == "teacher" and db.query(ClassroomMember).filter(
        ClassroomMember.classroom_id == classroom_id,
        ClassroomMember.student_id == current_user.id,
    ).first() is None or current_user.role == "teacher"
    
    if not (is_student or is_teacher):
        raise HTTPException(403, "You do not have access to this classroom")
    
    # Verify quiz exists
    quiz = db.query(ClassroomQuiz).filter(
        ClassroomQuiz.id == quiz_id,
        ClassroomQuiz.classroom_id == classroom_id,
    ).first()
    if not quiz:
        raise HTTPException(404, "Quiz not found")
    
    from db_models import ClassroomQuizAttempt, User
    
    if is_student:
        # Return only current student's attempts
        attempts = db.query(ClassroomQuizAttempt).filter(
            ClassroomQuizAttempt.quiz_id == quiz_id,
            ClassroomQuizAttempt.student_id == current_user.id,
        ).order_by(ClassroomQuizAttempt.submitted_at.desc()).all()
        
        return {
            "quiz_id": quiz_id,
            "student_id": current_user.id,
            "attempts": [
                {
                    "id": a.id,
                    "score": a.score,
                    "submitted_at": a.submitted_at.isoformat(),
                }
                for a in attempts
            ],
        }
    else:
        # Teacher view: return all students' results
        members = db.query(ClassroomMember).filter(
            ClassroomMember.classroom_id == classroom_id
        ).all()
        
        student_results = []
        for member in members:
            student = db.query(User).filter(User.id == member.student_id).first()
            if not student:
                continue
            
            # Get best attempt for this student
            best_attempt = db.query(ClassroomQuizAttempt).filter(
                ClassroomQuizAttempt.quiz_id == quiz_id,
                ClassroomQuizAttempt.student_id == member.student_id,
            ).order_by(ClassroomQuizAttempt.score.desc()).first()
            
            # Count total attempts
            attempt_count = db.query(ClassroomQuizAttempt).filter(
                ClassroomQuizAttempt.quiz_id == quiz_id,
                ClassroomQuizAttempt.student_id == member.student_id,
            ).count()
            
            student_results.append({
                "student_id": member.student_id,
                "student_name": student.full_name,
                "student_email": student.email,
                "attempted": attempt_count > 0,
                "attempt_count": attempt_count,
                "best_score": best_attempt.score if best_attempt else None,
                "last_submitted": best_attempt.submitted_at.isoformat() if best_attempt else None,
            })
        
        return {
            "quiz_id": quiz_id,
            "classroom_id": classroom_id,
            "total_students": len(members),
            "student_results": student_results,
        }


# ─────────────────────────────────────────────────────────────────────────────
# Material Reads tracking
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{classroom_id}/materials/{file_id}/mark-read")
def mark_material_as_read(
    classroom_id: int,
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a material as read by a student."""
    # Verify student has access to classroom
    member = db.query(ClassroomMember).filter(
        ClassroomMember.classroom_id == classroom_id,
        ClassroomMember.student_id == current_user.id,
    ).first()
    if not member and current_user.role != "teacher":
        raise HTTPException(403, "You do not have access to this classroom")

    # Verify file exists in this classroom
    file = db.query(ClassroomFile).filter(
        ClassroomFile.id == file_id,
        ClassroomFile.classroom_id == classroom_id,
    ).first()
    if not file:
        raise HTTPException(404, "File not found in this classroom")

    # Check if already marked as read
    existing = db.query(MaterialRead).filter(
        MaterialRead.file_id == file_id,
        MaterialRead.student_id == current_user.id,
    ).first()
    
    if existing:
        return {"status": "already_marked", "message": "Already marked as read"}

    # Mark as read
    read = MaterialRead(file_id=file_id, student_id=current_user.id)
    db.add(read)
    db.commit()
    db.refresh(read)
    
    return {"status": "marked", "read_at": read.marked_at}


@router.get("/{classroom_id}/materials-with-progress")
def get_classroom_materials_with_progress(
    classroom_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all materials in classroom with read status per student."""
    _verify_teacher_access(classroom_id, current_user, db)
    
    # Get all materials in classroom
    materials = db.query(ClassroomFile).filter(
        ClassroomFile.classroom_id == classroom_id
    ).order_by(ClassroomFile.uploaded_at.desc()).all()

    # Get all classroom students
    members = db.query(ClassroomMember).filter(
        ClassroomMember.classroom_id == classroom_id
    ).all()

    result = []
    for material in materials:
        # Get read status for each student
        reads = db.query(MaterialRead).filter(
            MaterialRead.file_id == material.id
        ).all()
        read_user_ids = {r.student_id for r in reads}

        student_progress = []
        for member in members:
            student_reads = db.query(User).filter(User.id == member.student_id).first()
            if student_reads:
                student_progress.append({
                    "student_id": member.student_id,
                    "student_name": student_reads.full_name,
                    "student_email": student_reads.email,
                    "marked_read": member.student_id in read_user_ids,
                })

        read_count = len(read_user_ids)
        total_students = len(members)

        result.append({
            "file_id": material.id,
            "filename": material.filename,
            "mime_type": material.mime_type,
            "uploaded_by": material.uploaded_by,
            "uploaded_at": material.uploaded_at,
            "read_count": read_count,
            "total_students": total_students,
            "read_percentage": round((read_count / total_students * 100) if total_students > 0 else 0, 1),
            "student_progress": student_progress,
        })

    return result


@router.get("/{classroom_id}/quizzes-with-progress")
def get_classroom_quizzes_with_progress(
    classroom_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all teacher-created quizzes in classroom with attempt status per student."""
    _verify_teacher_access(classroom_id, current_user, db)

    # Get all quizzes created by this teacher in this classroom
    quizzes = db.query(ClassroomQuiz).filter(
        ClassroomQuiz.classroom_id == classroom_id,
        ClassroomQuiz.created_by == current_user.id,
    ).order_by(ClassroomQuiz.created_at.desc()).all()

    # Get all classroom students
    members = db.query(ClassroomMember).filter(
        ClassroomMember.classroom_id == classroom_id
    ).all()

    result = []
    for quiz in quizzes:
        # Get attempts for this quiz from ClassroomQuizAttempt
        attempts = db.query(ClassroomQuizAttempt).filter(
            ClassroomQuizAttempt.quiz_id == quiz.id
        ).all()
        
        attempt_user_ids = {a.student_id for a in attempts}
        student_progress = []
        
        for member in members:
            student = db.query(User).filter(User.id == member.student_id).first()
            if student:
                # Get all attempts for this student on this quiz
                student_attempts = db.query(ClassroomQuizAttempt).filter(
                    ClassroomQuizAttempt.quiz_id == quiz.id,
                    ClassroomQuizAttempt.student_id == member.student_id,
                ).order_by(ClassroomQuizAttempt.submitted_at.asc()).all()
                
                all_scores = [a.score for a in student_attempts]
                best_score = max(all_scores) if all_scores else None
                
                student_progress.append({
                    "student_id": member.student_id,
                    "student_name": student.full_name,
                    "student_email": student.email,
                    "attempted": member.student_id in attempt_user_ids,
                    "all_scores": all_scores,
                    "best_score": best_score,
                    "attempt_count": len(student_attempts),
                })

        attempt_count = len(attempt_user_ids)
        total_students = len(members)

        result.append({
            "quiz_id": quiz.id,
            "title": quiz.title,
            "status": quiz.status,
            "created_at": quiz.created_at,
            "attempt_count": attempt_count,
            "total_students": total_students,
            "attempt_percentage": round((attempt_count / total_students * 100) if total_students > 0 else 0, 1),
            "student_progress": student_progress,
        })

    return result


# ---------------------------------------------------------------------------
# Practical Challenge endpoints — Teacher-managed coding challenges
# ---------------------------------------------------------------------------

class PracticalChallengeQuestion(BaseModel):
    title: str
    description: str
    note: Optional[str] = ""
    methods: List[Dict[str, Any]] = []
    expectedOutput: List[str] = []


class PracticalChallengeCode(BaseModel):
    """Base/starter code or model solution structure."""
    # class name is stored as "class" in JSON, use alias
    class_name: str = "Main"
    helperClasses: str = ""
    methods: Dict[str, Any] = {}


class PracticalChallengeResponse(BaseModel):
    id: int
    classroom_id: int
    section_id: Optional[int]
    title: str
    topic_prompt: Optional[str]
    question: Dict[str, Any]
    base_code: Dict[str, Any]
    model_solution: Dict[str, Any]
    status: str
    created_by: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GeneratePracticalChallengeRequest(BaseModel):
    topic_prompt: str           # e.g. "Inheritance and Polymorphism"
    section_id: Optional[int] = None
    source: str = "classroom"   # 'classroom' | 'course' | 'both'
    file_ids: Optional[List[int]] = None
    course_path: Optional[str] = None


class SavePracticalChallengeRequest(BaseModel):
    title: str
    topic_prompt: Optional[str] = None
    question: Dict[str, Any]
    base_code: Dict[str, Any]
    model_solution: Dict[str, Any]
    section_id: Optional[int] = None
    status: str = "draft"       # "draft" | "published"
    attempt_limit: Optional[int] = None  # max attempts per student (None = unlimited)


class UpdatePracticalChallengeRequest(BaseModel):
    title: Optional[str] = None
    topic_prompt: Optional[str] = None
    question: Optional[Dict[str, Any]] = None
    base_code: Optional[Dict[str, Any]] = None
    model_solution: Optional[Dict[str, Any]] = None
    section_id: Optional[int] = None
    status: Optional[str] = None
    attempt_limit: Optional[int] = None  # max attempts per student


@router.post("/{classroom_id}/practical-challenges/generate")
async def generate_classroom_practical_challenge(
    classroom_id: int,
    data: GeneratePracticalChallengeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a practical coding challenge with model solution for teacher preview.
    Can use classroom materials, course content, or both as reference material.
    Nothing is saved — teacher reviews/edits, then calls the save endpoint."""
    _verify_teacher_access(classroom_id, current_user, db)

    if not data.topic_prompt.strip():
        raise HTTPException(400, "topic_prompt cannot be empty")

    if data.source not in ("classroom", "course", "both"):
        raise HTTPException(400, "source must be 'classroom', 'course', or 'both'")

    # Gather context from selected sources (same as quiz generation)
    course_chunks = []
    classroom_chunks = []

    if data.source in ("course", "both"):
        valid_paths = {"basic_java", "enhanced_java"}
        course_path = data.course_path or "basic_java"
        if course_path not in valid_paths:
            raise HTTPException(400, f"course_path must be one of {valid_paths}")
        try:
            from routers.rag import get_retriever
            retriever = await get_retriever()
            docs = retriever.invoke(data.topic_prompt)
            course_chunks = [{"text": d.page_content} for d in docs]
            print(f"✓ Retrieved {len(course_chunks)} chunks from course content ({course_path})")
        except Exception as exc:
            if data.source == "course":
                raise HTTPException(503, f"Course content unavailable: {str(exc)}")
            print(f"⚠️ Course content unavailable (proceeding with classroom only): {str(exc)}")
            course_chunks = []

    if data.source in ("classroom", "both"):
        if data.file_ids:
            valid_ids = [
                f.id for f in db.query(ClassroomFile)
                               .filter(ClassroomFile.classroom_id == classroom_id,
                                       ClassroomFile.id.in_(data.file_ids))
                               .all()
            ]
            if not valid_ids:
                raise HTTPException(404, "None of the selected files were found in this classroom.")
            classroom_chunks = get_chunks_for_files(classroom_id, valid_ids, db)
            print(f"✓ Retrieved {len(classroom_chunks)} chunks from {len(valid_ids)} selected classroom files")
        else:
            classroom_chunks = search_classroom_context(
                classroom_id=classroom_id,
                query=data.topic_prompt,
                db=db,
                top_k=10,
            )
            print(f"✓ Retrieved {len(classroom_chunks)} chunks from classroom RAG search")
        
        if not classroom_chunks and data.source == "classroom":
            raise HTTPException(400, "No classroom documents found. Upload documents first, then generate a challenge.")

    # Merge and deduplicate
    merged = []
    seen = set()
    for c in (course_chunks + classroom_chunks):
        t = (c["text"] if isinstance(c, dict) else str(c)).strip()
        if not t or t in seen:
            continue
        seen.add(t)
        merged.append(c)

    if not merged:
        raise HTTPException(400, f"No context found from selected sources ({data.source}). Try uploading documents or selecting a different course.")

    # Build context string
    texts = [c["text"] if isinstance(c, dict) else str(c) for c in merged]
    context_str = "\n\n---\n\n".join(texts)
    if len(context_str) > 7000:
        context_str = context_str[:7000] + "\n...[context truncated]"

    # Import the existing generator and pass reference material
    from routers.practical_tests import _generate_practical_question
    try:
        result = await _generate_practical_question(
            data.topic_prompt.strip(), 
            [],
            reference_material=context_str if merged else None
        )
    except Exception as exc:
        raise HTTPException(502, f"AI generation failed: {str(exc)}")

    print(f"✅ Generated practical challenge for classroom {classroom_id}, topic: {data.topic_prompt}, source: {data.source}")
    return {
        "question":       result.get("question", {}),
        "base_code":      result.get("baseCode", {}),
        "model_solution": result.get("solution", {}),
        "topic_prompt":   data.topic_prompt.strip(),
        "source": data.source,
        "context_chunks_used": len(merged),
    }


@router.post("/{classroom_id}/practical-challenges", response_model=PracticalChallengeResponse, status_code=status.HTTP_201_CREATED)
def save_classroom_practical_challenge(
    classroom_id: int,
    data: SavePracticalChallengeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save a practical challenge (draft or published) for a classroom."""
    _verify_teacher_access(classroom_id, current_user, db)

    if not data.title.strip():
        raise HTTPException(400, "title cannot be empty")
    if data.status not in ("draft", "published"):
        raise HTTPException(400, "status must be 'draft' or 'published'")

    challenge = ClassroomPracticalChallenge(
        classroom_id=classroom_id,
        section_id=data.section_id,
        title=data.title.strip(),
        topic_prompt=data.topic_prompt,
        question=data.question,
        base_code=data.base_code,
        model_solution=data.model_solution,
        status=data.status,
        attempt_limit=data.attempt_limit,
        created_by=current_user.id,
    )
    db.add(challenge)
    db.commit()
    db.refresh(challenge)
    return challenge


@router.get("/{classroom_id}/practical-challenges", response_model=List[PracticalChallengeResponse])
def list_classroom_practical_challenges(
    classroom_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List practical challenges. Teachers see all (draft + published); students see published only."""
    _verify_classroom_access(classroom_id, current_user, db)

    q = db.query(ClassroomPracticalChallenge).filter(
        ClassroomPracticalChallenge.classroom_id == classroom_id
    )
    if current_user.role == "student":
        q = q.filter(ClassroomPracticalChallenge.status == "published")
    challenges = q.order_by(ClassroomPracticalChallenge.created_at.desc()).all()
    return challenges


@router.get("/{classroom_id}/practical-challenges/{challenge_id}", response_model=PracticalChallengeResponse)
def get_classroom_practical_challenge(
    classroom_id: int,
    challenge_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single practical challenge. Students only see published ones."""
    _verify_classroom_access(classroom_id, current_user, db)
    challenge = db.query(ClassroomPracticalChallenge).filter(
        ClassroomPracticalChallenge.id == challenge_id,
        ClassroomPracticalChallenge.classroom_id == classroom_id,
    ).first()
    if not challenge:
        raise HTTPException(404, "Challenge not found")
    if current_user.role == "student" and challenge.status != "published":
        raise HTTPException(404, "Challenge not found")
    return challenge


@router.patch("/{classroom_id}/practical-challenges/{challenge_id}", response_model=PracticalChallengeResponse)
def update_classroom_practical_challenge(
    classroom_id: int,
    challenge_id: int,
    data: UpdatePracticalChallengeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update title, question, base_code, model_solution, section, or status."""
    _verify_teacher_access(classroom_id, current_user, db)
    challenge = db.query(ClassroomPracticalChallenge).filter(
        ClassroomPracticalChallenge.id == challenge_id,
        ClassroomPracticalChallenge.classroom_id == classroom_id,
    ).first()
    if not challenge:
        raise HTTPException(404, "Challenge not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(challenge, field, value)

    challenge.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(challenge)
    return challenge


@router.delete("/{classroom_id}/practical-challenges/{challenge_id}")
def delete_classroom_practical_challenge(
    classroom_id: int,
    challenge_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a practical challenge."""
    _verify_teacher_access(classroom_id, current_user, db)
    challenge = db.query(ClassroomPracticalChallenge).filter(
        ClassroomPracticalChallenge.id == challenge_id,
        ClassroomPracticalChallenge.classroom_id == classroom_id,
    ).first()
    if not challenge:
        raise HTTPException(404, "Challenge not found")
    db.delete(challenge)
    db.commit()
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# PRACTICAL CHALLENGE SUBMISSIONS & RESULTS
# ─────────────────────────────────────────────────────────────────────────────

class SubmitPracticalChallengeRequest(BaseModel):
    """Submit solution code for a practical challenge."""
    submitted_code: Dict[str, str]  # {class_name: code_string, ...}
    execution_output: Optional[Dict[str, Any]] = None  # Result from code execution


class PracticalChallengeAttemptResponse(BaseModel):
    id: int
    challenge_id: int
    student_id: int
    passed: bool
    execution_output: Optional[Dict[str, Any]]
    submitted_at: datetime

    class Config:
        from_attributes = True


@router.post("/{classroom_id}/practical-challenges/{challenge_id}/submit")
def submit_practical_challenge_attempt(
    classroom_id: int,
    challenge_id: int,
    data: SubmitPracticalChallengeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit solution code and execution result for a practical challenge.
    Students submit their code; the result is tracked for teacher dashboard."""
    
    # Verify student is in classroom
    _verify_classroom_access(classroom_id, current_user, db)
    if current_user.role != "student":
        raise HTTPException(403, "Only students can submit challenge attempts")
    
    # Verify challenge exists and is published
    challenge = db.query(ClassroomPracticalChallenge).filter(
        ClassroomPracticalChallenge.id == challenge_id,
        ClassroomPracticalChallenge.classroom_id == classroom_id,
        ClassroomPracticalChallenge.status == "published",
    ).first()
    if not challenge:
        raise HTTPException(404, "Challenge not found or not yet published")
    
    # Determine if passed based on execution output
    passed = False
    if data.execution_output:
        # Check if test cases passed
        passed = data.execution_output.get("passed", False) or data.execution_output.get("all_passed", False)
        # If not explicitly marked, check for successful execution (no build errors, no stderr)
        if not passed and not data.execution_output.get("stderr") and not data.execution_output.get("build_stderr"):
            passed = data.execution_output.get("status") == "completed"
    
    # Create or update attempt record
    attempt = db.query(ClassroomPracticalChallengeAttempt).filter(
        ClassroomPracticalChallengeAttempt.challenge_id == challenge_id,
        ClassroomPracticalChallengeAttempt.student_id == current_user.id,
    ).order_by(ClassroomPracticalChallengeAttempt.submitted_at.desc()).first()
    
    # Always create a new attempt record (don't update previous ones)
    attempt = ClassroomPracticalChallengeAttempt(
        challenge_id=challenge_id,
        student_id=current_user.id,
        submitted_code=data.submitted_code,
        passed=passed,
        execution_output=data.execution_output,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    
    return attempt


@router.get("/{classroom_id}/practical-challenges/{challenge_id}/attempts")
def get_practical_challenge_attempts(
    classroom_id: int,
    challenge_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all attempts for a challenge.
    - Teachers see all student attempts
    - Students see only their own attempts"""
    
    _verify_classroom_access(classroom_id, current_user, db)
    
    # Verify challenge exists
    challenge = db.query(ClassroomPracticalChallenge).filter(
        ClassroomPracticalChallenge.id == challenge_id,
        ClassroomPracticalChallenge.classroom_id == classroom_id,
    ).first()
    if not challenge:
        raise HTTPException(404, "Challenge not found")
    
    q = db.query(ClassroomPracticalChallengeAttempt).filter(
        ClassroomPracticalChallengeAttempt.challenge_id == challenge_id
    )
    
    # Students can only see their own attempts
    if current_user.role == "student":
        q = q.filter(ClassroomPracticalChallengeAttempt.student_id == current_user.id)
    
    attempts = q.order_by(ClassroomPracticalChallengeAttempt.submitted_at.desc()).all()
    return attempts


@router.get("/{classroom_id}/practical-challenges/{challenge_id}/best-attempt")
def get_best_practical_challenge_attempt(
    classroom_id: int,
    challenge_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the best (most recent passed, or latest) attempt for the current student.
    Useful for displaying pass status on student dashboard."""
    
    _verify_classroom_access(classroom_id, current_user, db)
    if current_user.role != "student":
        raise HTTPException(403, "Only students can view their best attempt")
    
    # Verify challenge exists
    challenge = db.query(ClassroomPracticalChallenge).filter(
        ClassroomPracticalChallenge.id == challenge_id,
        ClassroomPracticalChallenge.classroom_id == classroom_id,
    ).first()
    if not challenge:
        raise HTTPException(404, "Challenge not found")
    
    # Check for passed attempt first
    passed_attempt = db.query(ClassroomPracticalChallengeAttempt).filter(
        ClassroomPracticalChallengeAttempt.challenge_id == challenge_id,
        ClassroomPracticalChallengeAttempt.student_id == current_user.id,
        ClassroomPracticalChallengeAttempt.passed == True,
    ).order_by(ClassroomPracticalChallengeAttempt.submitted_at.asc()).first()
    
    if passed_attempt:
        return passed_attempt
    
    # Otherwise return latest attempt
    latest_attempt = db.query(ClassroomPracticalChallengeAttempt).filter(
        ClassroomPracticalChallengeAttempt.challenge_id == challenge_id,
        ClassroomPracticalChallengeAttempt.student_id == current_user.id,
    ).order_by(ClassroomPracticalChallengeAttempt.submitted_at.desc()).first()
    
    if not latest_attempt:
        raise HTTPException(404, "No attempts found for this challenge")
    
    return latest_attempt


@router.get("/{classroom_id}/practical-challenges/{challenge_id}/student-results")
def get_practical_challenge_student_results(
    classroom_id: int,
    challenge_id: int,
    student_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all student results for a challenge (teacher view) or current student's results (student view)."""
    
    _verify_classroom_access(classroom_id, current_user, db)
    
    if current_user.role == "student":
        # Students see only their own results
        student_id = current_user.id
    elif not student_id:
        # Teachers get all unique students who attempted
        results = db.query(ClassroomPracticalChallengeAttempt).filter(
            ClassroomPracticalChallengeAttempt.challenge_id == challenge_id
        ).all()
        # Group by student
        by_student = {}
        for attempt in results:
            if attempt.student_id not in by_student:
                student = db.query(User).filter(User.id == attempt.student_id).first()
                by_student[attempt.student_id] = {
                    "student_id": attempt.student_id,
                    "student_name": student.full_name if student else "Unknown",
                    "student_email": student.email if student else "",
                    "attempts_count": 0,
                    "passed_count": 0,
                    "failed_count": 0,
                    "all_attempts": [],
                    "passed": False,
                    "latest_attempt": None,
                }
            by_student[attempt.student_id]["attempts_count"] += 1
            if attempt.passed:
                by_student[attempt.student_id]["passed"] = True
                by_student[attempt.student_id]["passed_count"] += 1
            else:
                by_student[attempt.student_id]["failed_count"] += 1
            by_student[attempt.student_id]["all_attempts"].append(attempt)
            # Always update to latest
            by_student[attempt.student_id]["latest_attempt"] = attempt
        return list(by_student.values())
    
    # Get specific student's results
    results = db.query(ClassroomPracticalChallengeAttempt).filter(
        ClassroomPracticalChallengeAttempt.challenge_id == challenge_id,
        ClassroomPracticalChallengeAttempt.student_id == student_id,
    ).order_by(ClassroomPracticalChallengeAttempt.submitted_at.desc()).all()
    
    return {"student_id": student_id, "attempts": results}

