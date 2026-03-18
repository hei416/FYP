import re
from sqlalchemy.orm import Session
from db_models import ErrorExplanationCache
from datetime import datetime
import re
from sqlalchemy.orm import Session
from db_models import ErrorExplanationCache
from datetime import datetime


def _normalize_error_key(error_message: str) -> str:
    """Strip file/line prefix so 'Main.java:3: error: ';' expected'
    and 'Main.java:17: error: ';' expected' share the same cache key."""
    msg = error_message.strip().lower()
    # Remove "Filename.java:3: error: " prefix
    msg = re.sub(r'^[^:]+\.java:\d+:\s*(error|warning):\s*', '', msg)
    return msg.strip()


def get_cached_explanation(db: Session, error_message: str) -> str | None:
    key = _normalize_error_key(error_message)
    entry = db.query(ErrorExplanationCache).filter_by(error_key=key).first()
    if entry:
        entry.hit_count += 1
        entry.updated_at = datetime.utcnow()
        db.commit()
        return entry.friendly_explanation
    import re
    from sqlalchemy.orm import Session
    from db_models import ErrorExplanationCache
    from datetime import datetime


    def _normalize_error_key(error_message: str) -> str:
        """Strip file/line prefix so 'Main.java:3: error: ';' expected'
        and 'Main.java:17: error: ';' expected' share the same cache key."""
        msg = error_message.strip().lower()
        # Remove "Filename.java:3: error: " prefix
        msg = re.sub(r'^[^:]+\.java:\d+:\s*(error|warning):\s*', '', msg)
        return msg.strip()


    def get_cached_explanation(db: Session, error_message: str) -> str | None:
        key = _normalize_error_key(error_message)
        entry = db.query(ErrorExplanationCache).filter_by(error_key=key).first()
        if entry:
            entry.hit_count += 1
            entry.updated_at = datetime.utcnow()
            db.commit()
            return entry.friendly_explanation
        return None


    def store_explanation(db: Session, error_message: str, explanation: str):
        key = _normalize_error_key(error_message)
        if not db.query(ErrorExplanationCache).filter_by(error_key=key).first():
            db.add(ErrorExplanationCache(error_key=key, friendly_explanation=explanation))
            db.commit()


    def build_explain_prompt(error_message: str, code_snippet: str, line_number: int) -> str:
        return f"""You are a friendly Java tutor helping a beginner student.

    The student's code has this compiler error on line {line_number}:
      "{error_message}"

    Relevant code context:
    ```java
    {code_snippet}
    ```

    Explain the error in 2-3 simple sentences. Be specific about what to fix and where.
    Example format: "You're missing a semicolon at the end of line {line_number}. In Java, every statement must end with ;. Add ; after [specific expression]."
    Do NOT use jargon. Keep it short and actionable."""