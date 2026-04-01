#!/usr/bin/env python3
"""
Migration script to add page_number column to classroom_chunks table.
Run this after updating the code to ensure existing databases are updated.
"""

from sqlalchemy import create_engine, text
from core.config import DATABASE_URL

def migrate():
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        # Check if column already exists
        try:
            result = conn.execute(text("""
                SELECT column_name FROM information_schema.columns 
                WHERE table_name='classroom_chunks' AND column_name='page_number'
            """))
            if result.fetchone():
                print("✓ page_number column already exists")
                conn.close()
                return
        except Exception as e:
            print(f"Warning: Could not check existing columns: {e}")
        
        # Add the column if it doesn't exist
        try:
            conn.execute(text("""
                ALTER TABLE classroom_chunks 
                ADD COLUMN page_number INTEGER DEFAULT 1
            """))
            conn.commit()
            print("✓ Successfully added page_number column to classroom_chunks")
        except Exception as e:
            print(f"Error adding column: {e}")
            conn.rollback()

if __name__ == "__main__":
    migrate()
