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
    is_active = Column(Boolean, default=True)

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
