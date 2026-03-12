from database import engine, Base
from db_models import User, UserProgress, QuizAttempt, TestAttempt

if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created successfully!")
    print("   - users")
    print("   - user_progress")
    print("   - quiz_attempts")
    print("   - test_attempts")
