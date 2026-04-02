#!/usr/bin/env python3
"""Quick verification that the schema migration was successful."""

from sqlalchemy import create_engine, text

PG_URL = (
    "postgresql://fypAdmin:FypDB%402026!@fyp-postgres-db.postgres.database.azure.com"
    "/learning_platform?sslmode=require"
)

def verify_schema():
    """Verify the schema is correct."""
    engine = create_engine(PG_URL, pool_pre_ping=True)
    
    print("🔍 Verifying database schema...")
    with engine.connect() as conn:
        # Check column type
        result = conn.execute(text("""
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_name = 'user_progress' AND column_name = 'dismissed_milestones'
        """))
        col_info = result.fetchone()
        
        if not col_info:
            print("❌ Column 'dismissed_milestones' not found!")
            return False
        
        print(f"✅ Column found:")
        print(f"   Name: {col_info[0]}")
        print(f"   Type: {col_info[1]}")
        print(f"   Default: {col_info[2]}")
        
        if col_info[1].lower() != 'json':
            print(f"❌ Column type is {col_info[1]}, expected 'json'!")
            return False
        
        # Test data retrieval
        print("\n✅ Testing data retrieval...")
        result = conn.execute(text("""
            SELECT id, user_id, dismissed_milestones FROM user_progress LIMIT 3
        """))
        rows = result.fetchall()
        for row in rows:
            print(f"   Row {row[0]}: user_id={row[1]}, dismissed_milestones={row[2]} (type: {type(row[2]).__name__})")
        
        print("\n✅ ✅ ✅ SCHEMA VERIFICATION SUCCESSFUL!")
        print("The dismissed_milestones column is now JSON type and data retrieval works correctly.")
        return True

if __name__ == "__main__":
    success = verify_schema()
    exit(0 if success else 1)
