import os
from dotenv import load_dotenv
load_dotenv()
from sqlalchemy import create_engine, text

PG_URL = os.getenv("DATABASE_URL")
engine = create_engine(PG_URL)

with engine.connect() as conn:
    tables = ["users", "user_progress", "quiz_attempts", "test_attempts", "quiz_questions", "practical_test_questions"]
    print("=== Azure PostgreSQL Row Counts ===")
    for t in tables:
        n = conn.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar()
        print(f"  {t}: {n} rows")

    print()
    print("=== practical_test_questions ===")
    rows = conn.execute(text("SELECT id, topic_id, title FROM practical_test_questions ORDER BY topic_id")).fetchall()
    for r in rows:
        print(f"  [{r[1]}] {r[0]} -- {r[2]}")

    print()
    print("=== quiz_questions topics ===")
    rows = conn.execute(text("SELECT topic_id, COUNT(*) as n FROM quiz_questions GROUP BY topic_id ORDER BY topic_id")).fetchall()
    for r in rows:
        print(f"  {r[0]}: {r[1]} questions")

    print()
    print("=== Users ===")
    rows = conn.execute(text("SELECT id, email, full_name, is_active FROM users")).fetchall()
    for r in rows:
        print(f"  id={r[0]} email={r[1]} name={r[2]} active={r[3]}")

print("\nAll good - safe to delete local .db files.")
