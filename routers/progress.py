from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional, Any
from database import get_db
from db_models import User, UserProgress, QuizAttempt, TestAttempt, SavedWork
from routers.auth import get_current_user
import json

router = APIRouter(prefix="/progress", tags=["progress"])

# Pydantic models
class ProgressUpdate(BaseModel):
    completed_topics: List[str] = None
    dismissed_milestones: List[str] = None
    quizzes_attempted: int = None
    quizzes_completed: List[str] = None
    tests_attempted: int = None
    tests_passed: List[str] = None
    playground_executions: int = None
    playground_completed: bool = None
    ai_interactions: int = None

class QuizAttemptRequest(BaseModel):
    quiz_id: str
    score: float
    answers: Optional[Any] = None

class TestAttemptRequest(BaseModel):
    test_id: str
    score: float
    passed: bool
    feedback: dict = None

class TopicCompletionRequest(BaseModel):
    topic_id: str


class ProgressResponse(BaseModel):
    id: int
    user_id: int
    completed_topics: List[str]
    dismissed_milestones: Optional[List[str]] = None
    quizzes_attempted: int
    quizzes_completed: List[str]
    tests_attempted: int
    tests_passed: List[str]
    playground_executions: int
    playground_completed: bool
    ai_interactions: int
    completion_percentage: float
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Helper function to get or create user progress
def get_user_progress(user_id: int, db: Session) -> UserProgress:
    """Get or create user progress record"""
    progress = db.query(UserProgress).filter(UserProgress.user_id == user_id).first()
    if not progress:
        progress = UserProgress(user_id=user_id)
        db.add(progress)
        db.commit()
        db.refresh(progress)
    return progress

# Routes
@router.get("/me", response_model=ProgressResponse)
async def get_user_progress_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's progress"""
    progress = get_user_progress(current_user.id, db)
    from datetime import datetime
    return ProgressResponse(
        id=progress.id,
        user_id=progress.user_id,
        completed_topics=progress.completed_topics or [],
        dismissed_milestones=progress.dismissed_milestones or [],
        quizzes_attempted=progress.quizzes_attempted or 0,
        quizzes_completed=progress.quizzes_completed or [],
        tests_attempted=progress.tests_attempted or 0,
        tests_passed=progress.tests_passed or [],
        playground_executions=progress.playground_executions or 0,
        playground_completed=progress.playground_completed or False,
        ai_interactions=progress.ai_interactions or 0,
        completion_percentage=progress.completion_percentage or 0.0,
        updated_at=progress.updated_at or datetime.utcnow(),
    )

@router.post("/sync")
async def sync_progress(
    update: ProgressUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Merge-sync progress from frontend.
    Never overwrites a completed item with an incomplete one:
    - Lists are unioned (completed items are never removed)
    - Counts use max() so they only go up
    - Booleans use OR so completed=True is never lost
    """
    progress = get_user_progress(current_user.id, db)

    # Union merge for lists (never remove completed items)
    if update.completed_topics is not None:
        existing = set(progress.completed_topics or [])
        progress.completed_topics = list(existing | set(update.completed_topics))

    # Merge dismissed milestones (union)
    if getattr(update, 'dismissed_milestones', None) is not None:
        existing_dm = set(progress.dismissed_milestones or [])
        progress.dismissed_milestones = list(existing_dm | set(update.dismissed_milestones))

    if update.quizzes_completed is not None:
        existing = set(progress.quizzes_completed or [])
        progress.quizzes_completed = list(existing | set(update.quizzes_completed))

    if update.tests_passed is not None:
        existing = set(progress.tests_passed or [])
        progress.tests_passed = list(existing | set(update.tests_passed))

    # Max merge for counters (only go up)
    if update.quizzes_attempted is not None:
        progress.quizzes_attempted = max(progress.quizzes_attempted or 0, update.quizzes_attempted)

    if update.tests_attempted is not None:
        progress.tests_attempted = max(progress.tests_attempted or 0, update.tests_attempted)

    if update.playground_executions is not None:
        progress.playground_executions = max(progress.playground_executions or 0, update.playground_executions)

    if update.ai_interactions is not None:
        progress.ai_interactions = max(progress.ai_interactions or 0, update.ai_interactions)

    # OR merge for booleans (completed=True is never lost)
    if update.playground_completed is not None:
        progress.playground_completed = progress.playground_completed or update.playground_completed

    progress.last_synced = datetime.utcnow()
    db.commit()
    db.refresh(progress)

    return {
        "status": "synced",
        "message": "Progress merged successfully",
        "progress": {
            "completed_topics": progress.completed_topics,
            "dismissed_milestones": progress.dismissed_milestones,
            "quizzes_attempted": progress.quizzes_attempted,
            "quizzes_completed": progress.quizzes_completed,
            "tests_passed": progress.tests_passed,
            "playground_completed": progress.playground_completed,
            "completion_percentage": progress.completion_percentage
        }
    }

@router.post("/topic-complete")
async def mark_topic_complete(
    request: TopicCompletionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark a topic as completed"""
    progress = get_user_progress(current_user.id, db)
    
    # Add topic to completed list if not already there
    completed = progress.completed_topics or []
    if request.topic_id not in completed:
        completed.append(request.topic_id)
        progress.completed_topics = completed
        db.commit()
        db.refresh(progress)
    
    return {
        "status": "success",
        "message": f"Topic {request.topic_id} marked as completed",
        "completed_topics": progress.completed_topics
    }

@router.post("/quiz-attempt")
async def record_quiz_attempt(
    attempt: QuizAttemptRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Record a quiz attempt"""
    progress = get_user_progress(current_user.id, db)
    
    # Create quiz attempt record
    quiz_attempt = QuizAttempt(
        user_id=current_user.id,
        quiz_id=attempt.quiz_id,
        score=attempt.score,
        answers=attempt.answers
    )
    db.add(quiz_attempt)
    
    # Update progress
    progress.quizzes_attempted = (progress.quizzes_attempted or 0) + 1
    completed = progress.quizzes_completed or []
    if attempt.quiz_id not in completed:
        completed.append(attempt.quiz_id)
        progress.quizzes_completed = completed
    
    progress.last_synced = datetime.utcnow()
    db.commit()
    
    return {
        "status": "success",
        "message": "Quiz attempt recorded",
        "quiz_id": attempt.quiz_id,
        "score": attempt.score
    }

@router.post("/test-attempt")
async def record_test_attempt(
    attempt: TestAttemptRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Record a test attempt"""
    progress = get_user_progress(current_user.id, db)
    
    # Create test attempt record
    test_attempt = TestAttempt(
        user_id=current_user.id,
        test_id=attempt.test_id,
        score=attempt.score,
        passed=attempt.passed,
        feedback=attempt.feedback
    )
    db.add(test_attempt)
    
    # Update progress
    progress.tests_attempted = (progress.tests_attempted or 0) + 1
    if attempt.passed:
        passed = progress.tests_passed or []
        if attempt.test_id not in passed:
            passed.append(attempt.test_id)
            progress.tests_passed = passed
    
    progress.last_synced = datetime.utcnow()
    db.commit()
    
    return {
        "status": "success",
        "message": "Test attempt recorded",
        "test_id": attempt.test_id,
        "score": attempt.score,
        "passed": attempt.passed
    }

@router.post("/playground-use")
async def record_playground_use(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Record playground code execution"""
    progress = get_user_progress(current_user.id, db)
    
    progress.playground_executions = (progress.playground_executions or 0) + 1
    if progress.playground_executions >= 3:
        progress.playground_completed = True
    
    progress.last_synced = datetime.utcnow()
    db.commit()
    db.refresh(progress)
    
    return {
        "status": "success",
        "playground_executions": progress.playground_executions,
        "playground_completed": progress.playground_completed
    }

@router.post("/ai-interaction")
async def record_ai_interaction(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Record AI tutor interaction"""
    progress = get_user_progress(current_user.id, db)
    
    progress.ai_interactions = (progress.ai_interactions or 0) + 1
    progress.last_synced = datetime.utcnow()
    db.commit()
    db.refresh(progress)
    
    return {
        "status": "success",
        "ai_interactions": progress.ai_interactions
    }


@router.get("/weak-topics")
async def get_weak_topics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Return topics where the student scores below the pass threshold."""
    all_works = (
        db.query(SavedWork)
        .filter(SavedWork.user_id == current_user.id)
        .all()
    )

    def _score_of(rd):
        if not rd:
            return None
        if isinstance(rd, dict):
            s = rd.get("score")
            if isinstance(s, (int, float)):
                return float(s)
        return None

    def _topics_of(w):
        rd = w.result_data or {}
        for key in ("topics_covered", "topics"):
            val = rd.get(key)
            if isinstance(val, list) and val:
                return [str(t) for t in val]
        if w.topic_id:
            return [w.topic_id]
        return []

    # Aggregate per-topic scores by work type
    from collections import defaultdict
    topic_scores = defaultdict(list)  # topic -> list of scores

    for w in all_works:
        if w.work_type not in ("quiz", "test"):
            continue
        score = _score_of(w.result_data)
        if score is None:
            continue
        for topic in _topics_of(w):
            topic_scores[topic].append(score)

    pass_threshold = {"quiz": 70, "test": 60}
    # Use 70 as default threshold since we mix types
    weak = []
    for topic, scores in topic_scores.items():
        avg = sum(scores) / len(scores) if scores else 0
        if avg < 70:
            weak.append({"topic": topic, "avg_score": round(avg, 1), "attempts": len(scores)})

    weak.sort(key=lambda x: x["avg_score"])
    return {"weak_topics": weak}
