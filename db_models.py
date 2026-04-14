from database import Base
from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Boolean, ForeignKey, JSON, LargeBinary, UniqueConstraint, Index
from datetime import datetime
import json

class User(Base):
    """User model for authentication and progress tracking"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    role = Column(String(50), default="student", nullable=False)  # student / teacher / admin
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Classroom(Base):
    """A classroom created by a teacher"""
    __tablename__ = "classrooms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False, default="Official Lessons")
    description = Column(Text, nullable=True)
    class_code = Column(String(20), unique=True, nullable=False, index=True)  # e.g. JAVA101A
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    enrolled_courses = Column(JSON, default=lambda: ["basic"])  # list of course IDs: "basic", "enhanced"
    is_public = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ClassroomMember(Base):
    """Membership linking students to classrooms"""
    __tablename__ = "classroom_members"

    id = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    joined_at = Column(DateTime, default=datetime.utcnow)


class SavedWork(Base):
    """User's saved work items — playground snippets, quiz results, test results"""
    __tablename__ = "saved_work"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    work_type = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    topic_id = Column(String(255), nullable=True)
    content = Column(Text, nullable=True)
    result_data = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class UserProgress(Base):
    """User learning progress tracking"""
    __tablename__ = "user_progress"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)

    # Topics/Lessons
    completed_topics = Column(JSON, default=list)       # List of topic IDs

    # Quizzes
    quizzes_attempted = Column(Integer, default=0)
    quizzes_completed = Column(JSON, default=list)      # List of quiz IDs

    # Practical Tests
    tests_attempted = Column(Integer, default=0)
    tests_passed = Column(JSON, default=list)           # List of test IDs

    # Playground usage
    playground_executions = Column(Integer, default=0)
    playground_completed = Column(Boolean, default=False)

    # AI interactions
    ai_interactions = Column(Integer, default=0)

    # Dismissed milestone reminders
    dismissed_milestones = Column(JSON, default=list)

    # Overall progress
    completion_percentage = Column(Float, default=0.0)

    # Course identifier — one row per (user_id, course_id)
    course_id = Column(String(50), nullable=False, default="basic")

    # Timestamps
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_synced = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint("user_id", "course_id", name="uq_user_course"),)


# --- ClassroomDocument model for classroom document uploads ---
class ClassroomDocument(Base):
    """Documents uploaded by teachers to a classroom"""
    __tablename__ = "classroom_documents"

    id = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id"), nullable=False, index=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    original_name = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)   # 'pdf', 'txt', etc.
    status = Column(String(50), default="processing") # 'processing', 'ready', 'error'
    chunk_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


# ---------------------------------------------------------------------------
# Classroom File Storage (DB-backed RAG)
# ---------------------------------------------------------------------------

class ClassroomSection(Base):
    """A named section/folder within a classroom for organising files."""
    __tablename__ = "classroom_sections"

    id           = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id", ondelete="CASCADE"), nullable=False, index=True)
    name         = Column(String(255), nullable=False)
    description  = Column(Text, nullable=True)
    order        = Column(Integer, default=0)
    created_at   = Column(DateTime, default=datetime.utcnow)


class ClassroomFile(Base):
    """Raw file bytes uploaded by teachers to a classroom — stored in DB."""
    __tablename__ = "classroom_files"

    id           = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id", ondelete="CASCADE"), nullable=False, index=True)
    section_id   = Column(Integer, ForeignKey("classroom_sections.id", ondelete="SET NULL"), nullable=True, index=True)
    filename     = Column(String(255), nullable=False)
    mime_type    = Column(String(255), nullable=False)
    file_data    = Column(LargeBinary, nullable=False)   # raw bytes
    uploaded_by  = Column(Integer, ForeignKey("users.id"), nullable=True)
    uploaded_at  = Column(DateTime, default=datetime.utcnow)


class ClassroomChunk(Base):
    """Chunked text + embedding for classroom RAG, stored in DB."""
    __tablename__ = "classroom_chunks"

    id           = Column(Integer, primary_key=True, index=True)
    file_id      = Column(Integer, ForeignKey("classroom_files.id", ondelete="CASCADE"), nullable=False)
    classroom_id = Column(Integer, ForeignKey("classrooms.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_text   = Column(Text, nullable=False)
    embedding    = Column(LargeBinary, nullable=False)   # np.float32.tobytes()
    page_number  = Column(Integer, nullable=True, default=1)  # Page number for PDFs


class QuizAttempt(Base):
    """Individual quiz attempt tracking"""
    __tablename__ = "quiz_attempts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    quiz_id = Column(String(255), index=True, nullable=False)
    score = Column(Float, nullable=False)
    answers = Column(JSON, nullable=True)  # Store user's answers
    created_at = Column(DateTime, default=datetime.utcnow)

class TestAttempt(Base):
    """Individual test attempt tracking"""
    __tablename__ = "test_attempts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    test_id = Column(String(255), index=True, nullable=False)
    score = Column(Float, nullable=False)
    passed = Column(Boolean, default=False)
    feedback = Column(JSON, nullable=True)  # Store test feedback
    created_at = Column(DateTime, default=datetime.utcnow)

class QuizQuestion(Base):
    """AI-generated quiz questions (replaces quiz_store.db SQLite)"""
    __tablename__ = "quiz_questions"

    id = Column(String(255), primary_key=True)
    topic_id = Column(String(255), nullable=False, index=True)
    question = Column(Text, nullable=False)
    options = Column(JSON, nullable=False)  # List[str]
    correct_index = Column(Integer, nullable=False)
    explanation = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class PracticalTestQuestion(Base):
    """AI-generated practical test (coding exercise) questions stored by topic."""
    __tablename__ = "practical_test_questions"

    id = Column(String(255), primary_key=True)          # unique ID, e.g. pt_<timestamp>_<n>
    topic_id = Column(String(255), nullable=False, index=True)  # main topic name
    topics = Column(JSON, nullable=True)  # list of all topics for multi-topic questions
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=False)
    note = Column(Text, nullable=True)
    methods = Column(JSON, nullable=False)               # list of {name, description}
    expected_output = Column(JSON, nullable=False)       # list of strings
    base_class = Column(String(255), nullable=False)     # e.g. "Solution"
    base_methods = Column(JSON, nullable=False)          # {methodName: "signature {}"}
    base_helper_classes = Column(Text, nullable=True)    # non-public helper class definitions for base
    solution_methods = Column(JSON, nullable=False)      # {methodName: [...lines]}
    solution_helper_classes = Column(Text, nullable=True) # non-public helper class definitions for solution
    created_at = Column(DateTime, default=datetime.utcnow)


class PracticalTestHint(Base):
    """Cache for AI-generated progressive hints for practical questions."""
    __tablename__ = "practical_test_hints"

    id = Column(Integer, primary_key=True, index=True)
    # A normalized key derived from the question/problem description (lowercased, stripped)
    question_key = Column(String(1000), nullable=False, index=True)
    # hint level: 'gentle', 'specific', 'detailed'
    hint_level = Column(String(50), nullable=False, index=True)
    # The generated hint text
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class ConversationHistory(Base):
    """Store user conversation history with turn-based organization and optional summarization"""
    __tablename__ = "conversation_history"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    conversation_id = Column(String(255), index=True, nullable=False, unique=False)  # Groups related turns
    
    # Turn information
    turn_number = Column(Integer, nullable=False)  # Sequential turn within conversation
    is_summarized = Column(Boolean, default=False)  # True if this is a summarized turn
    
    # Message content
    user_message = Column(Text, nullable=False)  # Original user input
    assistant_response = Column(Text, nullable=False)  # LLM response
    
    # Context and metadata
    context_type = Column(String(50), nullable=False)  # 'explain', 'hint', 'code_review', etc.
    code_snippet = Column(Text, nullable=True)  # Optional code snippet from user
    
    # Token usage for cost tracking
    input_tokens = Column(Integer, default=0)
    output_tokens = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Optional summary (when multiple old turns are compressed into one)
    summary_of_turns = Column(JSON, nullable=True)  # {"turn_range": [1, 5], "summary": "..."}


class ConversationSummary(Base):
    """Store summarized conversation segments to replace multiple old turns"""
    __tablename__ = "conversation_summaries"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    conversation_id = Column(String(255), index=True, nullable=False)
    
    # Summary metadata
    turn_range_start = Column(Integer, nullable=False)  # First turn included
    turn_range_end = Column(Integer, nullable=False)    # Last turn included
    num_original_turns = Column(Integer, nullable=False)  # How many turns were condensed
    
    # Summary content
    summary = Column(Text, nullable=False)  # Condensed summary of all turns
    key_points = Column(JSON, nullable=True)  # List of important points [str]
    
    # Cost metrics
    original_input_tokens = Column(Integer, default=0)
    original_output_tokens = Column(Integer, default=0)
    summary_input_tokens = Column(Integer, default=0)
    summary_output_tokens = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ErrorExplanationCache(Base):
    """Cache AI-generated friendly explanations for Java compiler errors.
    Keyed by a normalized error pattern so identical errors reuse the same explanation."""
    __tablename__ = "error_explanation_cache"

    id = Column(Integer, primary_key=True, index=True)
    # Normalized key: e.g. "';' expected" (the raw javac message, lowercased, stripped)
    error_key = Column(String(500), unique=True, index=True, nullable=False)
    # The friendly AI explanation
    friendly_explanation = Column(Text, nullable=False)
    # How many times this cache entry was reused (for analytics)
    hit_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ClassroomQuiz(Base):
    """A teacher-created quiz for a classroom, optionally scoped to a section."""
    __tablename__ = "classroom_quizzes"

    id           = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id", ondelete="CASCADE"), nullable=False, index=True)
    section_id   = Column(Integer, ForeignKey("classroom_sections.id", ondelete="SET NULL"), nullable=True, index=True)
    title        = Column(String(500), nullable=False)
    topic_prompt = Column(Text, nullable=True)       # prompt used to generate questions
    questions    = Column(JSON, nullable=False)       # list of MCQ dicts
    status       = Column(String(20), default="draft")  # "draft" | "published"
    attempt_limit = Column(Integer, default=None)     # max attempts allowed per student (None = unlimited)
    created_by   = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at   = Column(DateTime, default=datetime.utcnow)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ClassroomPracticalChallenge(Base):
    """A teacher-created coding challenge for a classroom, with AI-generated model solution."""
    __tablename__ = "classroom_practical_challenges"

    id             = Column(Integer, primary_key=True, index=True)
    classroom_id   = Column(Integer, ForeignKey("classrooms.id", ondelete="CASCADE"), nullable=False, index=True)
    section_id     = Column(Integer, ForeignKey("classroom_sections.id", ondelete="SET NULL"), nullable=True, index=True)
    title          = Column(String(500), nullable=False)
    topic_prompt   = Column(Text, nullable=True)         # prompt / topics used to generate
    question       = Column(JSON, nullable=False)        # {title, description, note, methods, expectedOutput}
    base_code      = Column(JSON, nullable=False)        # {class, helperClasses, methods}
    model_solution = Column(JSON, nullable=False)        # {class, helperClasses, methods} — teacher-reviewed
    status         = Column(String(20), default="draft") # "draft" | "published"
    attempt_limit  = Column(Integer, default=None)      # max attempts allowed per student (None = unlimited)
    created_by     = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at     = Column(DateTime, default=datetime.utcnow)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ClassroomPracticalChallengeAttempt(Base):
    """Track student submissions and results for practical challenges"""
    __tablename__ = "classroom_practical_challenge_attempts"

    id                = Column(Integer, primary_key=True, index=True)
    challenge_id      = Column(Integer, ForeignKey("classroom_practical_challenges.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id        = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Submission data
    submitted_code    = Column(JSON, nullable=False)     # {class_name: code_string, ...}
    
    # Execution result
    passed            = Column(Boolean, default=False)   # True if all tests passed
    execution_output  = Column(JSON, nullable=True)      # {stdout, stderr, build_stderr, passed_tests, etc.}
    
    # Timing and metadata
    submitted_at      = Column(DateTime, default=datetime.utcnow, index=True)
    
    __table_args__ = (Index('ix_challenge_student', 'challenge_id', 'student_id'),)


class ClassroomQuizAttempt(Base):
    """Track student quiz attempts and results for classroom quizzes"""
    __tablename__ = "classroom_quiz_attempts"

    id            = Column(Integer, primary_key=True, index=True)
    quiz_id       = Column(Integer, ForeignKey("classroom_quizzes.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Submission data
    score         = Column(Float, nullable=False)        # 0-100, percentage
    answers       = Column(JSON, nullable=True)          # {question_id: selected_option_index, ...}
    
    # Timing and metadata
    submitted_at  = Column(DateTime, default=datetime.utcnow, index=True)
    
    __table_args__ = (Index('ix_quiz_student', 'quiz_id', 'student_id'),)


class MaterialRead(Base):
    """Tracks which students have marked classroom materials as read."""
    __tablename__ = "material_reads"

    id           = Column(Integer, primary_key=True, index=True)
    file_id      = Column(Integer, ForeignKey("classroom_files.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id   = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    marked_at    = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint('file_id', 'student_id', name='uq_file_student_read'),)


class NLIMonitoringLog(Base):
    """Log NLI faithfulness checks for RAG responses.
    
    Async background monitoring task records whether LLM responses are grounded
    in retrieved context. Used for quality assurance and RAG pipeline tuning.
    """
    __tablename__ = "nli_monitoring_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    query_id = Column(String(255), unique=True, nullable=False, index=True)  # Unique ID from /ragAI response
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    
    # NLI faithfulness score and result
    nli_score = Column(Float, nullable=True)   # 0.0 to 1.0 (entailment probability)
    display_score = Column(Float, nullable=True)  # scaled score: min(nli_score / 0.35, 1.0)
    is_faithful = Column(Boolean, nullable=False)  # True if score >= 0.65 threshold
    threshold = Column(Float, default=0.65, nullable=False)  # NLI threshold used
    status = Column(String(50), nullable=False)  # "PASS", "ALERT", "ERROR"
    detail = Column(String(255), nullable=True)  # "entailment_ok", "low_entailment", "empty_context", etc.

    # Timing and tracking
    checked_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    __table_args__ = (
        Index('idx_user_checked', 'user_id', 'checked_at'),
        Index('idx_status_checked', 'status', 'checked_at'),
    )
