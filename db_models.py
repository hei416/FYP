from database import Base
from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Boolean, ForeignKey, JSON
from datetime import datetime
import json

class User(Base):
    """User model for authentication and progress tracking"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


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
    completed_topics = Column(JSON, default=list)  # List of topic IDs
    
    # Quizzes
    quizzes_attempted = Column(Integer, default=0)
    quizzes_completed = Column(JSON, default=list)  # List of quiz IDs
    
    # Practical Tests
    tests_attempted = Column(Integer, default=0)
    tests_passed = Column(JSON, default=list)  # List of test IDs
    
    # Playground usage
    playground_executions = Column(Integer, default=0)
    playground_completed = Column(Boolean, default=False)
    
    # AI interactions
    ai_interactions = Column(Integer, default=0)
    # Dismissed milestone reminders stored as a list of milestone ids/counts
    dismissed_milestones = Column(JSON, default=list)
    
    # Overall progress
    completion_percentage = Column(Float, default=0.0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_synced = Column(DateTime, default=datetime.utcnow)

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
