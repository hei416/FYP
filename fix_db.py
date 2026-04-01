from database import engine
from sqlalchemy import text
with engine.connect() as conn:
    conn.execute(text('ALTER TABLE classroom_chunks ADD COLUMN page_number INTEGER;'))
    conn.commit()
