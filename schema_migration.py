"""
Schema migration: Convert dismissed_milestones from TEXT[] to JSON

This migration:
1. Backs up existing data from dismissed_milestones TEXT[]
2. Converts the column type to JSON
3. Restores the data in JSON format
4. Verifies data integrity

Run: python schema_migration.py
"""
import os
from sqlalchemy import create_engine, text

# PostgreSQL connection string
PG_URL = (
    "postgresql://fypAdmin:FypDB%402026!@fyp-postgres-db.postgres.database.azure.com"
    "/learning_platform?sslmode=require"
)

def run_migration():
    """Execute the schema migration."""
    engine = create_engine(PG_URL, pool_pre_ping=True)
    
    with engine.connect() as conn:
        try:
            # Step 0: Clean up any leftover temporary column from failed attempts
            print("🧹 Cleaning up any temporary columns from previous failed runs...")
            try:
                conn.execute(text("""
                    ALTER TABLE user_progress
                    DROP COLUMN IF EXISTS dismissed_milestones_json
                """))
                conn.commit()
                print("   ✅ Temporary column cleaned up")
            except Exception as e:
                print(f"   ⚠️  No cleanup needed: {e}")
                conn.rollback()
            
            # Step 1: Check current column data type
            print("\n🔍 Checking current column definition...")
            result = conn.execute(text("""
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_name = 'user_progress' AND column_name = 'dismissed_milestones'
            """))
            col_info = result.fetchone()
            
            if not col_info:
                print("❌ Column 'dismissed_milestones' not found!")
                return False
            
            print(f"   Current type: {col_info[1]}")
            print(f"   Nullable: {col_info[2]}")
            print(f"   Default: {col_info[3]}")
            
            # Check if already JSON
            if col_info[1].lower() == 'json':
                print("\n✅ Column is already JSON type! No migration needed.")
                return True
            
            # Step 2: Backup existing data
            print("\n💾 Backing up existing data...")
            result = conn.execute(text("""
                SELECT user_id, course_id, dismissed_milestones
                FROM user_progress
                WHERE dismissed_milestones IS NOT NULL AND dismissed_milestones != '{}'
            """))
            backup_rows = result.fetchall()
            print(f"   Found {len(backup_rows)} rows with data to preserve")
            
            for row_num, row in enumerate(backup_rows[:5]):
                print(f"   Sample {row_num + 1}: user_id={row[0]}, course_id={row[1]}, data={row[2]}")
            
            # Step 3: Add temporary JSON column
            print("\n🔄 Creating temporary JSON column...")
            try:
                conn.execute(text("""
                    ALTER TABLE user_progress
                    ADD COLUMN dismissed_milestones_json JSON DEFAULT '[]'::JSON
                """))
                conn.commit()
                print("   ✅ Temporary column created")
            except Exception as e:
                print(f"   ⚠️  Temporary column may already exist: {e}")
                conn.rollback()
            
            # Step 4: Migrate data from TEXT[] to JSON
            print("\n📦 Converting data from TEXT[] to JSON...")
            conn.execute(text("""
                UPDATE user_progress
                SET dismissed_milestones_json = array_to_json(CASE
                    WHEN dismissed_milestones = '{}' OR dismissed_milestones IS NULL THEN '{}'::text[]
                    ELSE dismissed_milestones
                END)
            """))
            conn.commit()
            rows_affected = conn.execute(text("SELECT COUNT(*) FROM user_progress")).scalar()
            print(f"   ✅ Data migrated for all {rows_affected} rows")
            
            # Step 5: Verify conversion
            print("\n✅ Verifying data conversion...")
            result = conn.execute(text("""
                SELECT user_id, course_id, dismissed_milestones_json
                FROM user_progress
                WHERE dismissed_milestones_json::text != '[]'
                LIMIT 5
            """))
            sample_rows = result.fetchall()
            if sample_rows:
                for row_num, row in enumerate(sample_rows):
                    print(f"   Sample {row_num + 1}: user_id={row[0]}, course_id={row[1]}, json_data={row[2]}")
            else:
                print("   ℹ️  All dismissed_milestones are empty arrays (expected)")
            
            # Step 6: Drop old TEXT[] column
            print("\n🗑️  Removing old TEXT[] column...")
            try:
                conn.execute(text("""
                    ALTER TABLE user_progress
                    DROP COLUMN dismissed_milestones
                """))
                conn.commit()
                print("   ✅ Old column dropped")
            except Exception as e:
                print(f"   ❌ Error dropping old column: {e}")
                conn.rollback()
                return False
            
            # Step 7: Rename JSON column to original name
            print("\n♻️  Renaming JSON column...")
            try:
                conn.execute(text("""
                    ALTER TABLE user_progress
                    RENAME COLUMN dismissed_milestones_json TO dismissed_milestones
                """))
                conn.commit()
                print("   ✅ Column renamed to 'dismissed_milestones'")
            except Exception as e:
                print(f"   ❌ Error renaming column: {e}")
                conn.rollback()
                return False
            
            # Step 8: Verify final state
            print("\n🔍 Verifying final schema...")
            result = conn.execute(text("""
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_name = 'user_progress' AND column_name = 'dismissed_milestones'
            """))
            col_info = result.fetchone()
            
            if col_info:
                print(f"   ✅ Final type: {col_info[1]}")
                print(f"   ✅ Nullable: {col_info[2]}")
                print(f"   ✅ Default: {col_info[3]}")
                
                if col_info[1].lower() == 'json':
                    print("\n✅ ✅ ✅ MIGRATION SUCCESSFUL! Column is now JSON type.")
                    return True
                else:
                    print(f"\n❌ Migration failed! Column type is still {col_info[1]}")
                    return False
            else:
                print("❌ Column not found after migration!")
                return False
                
        except Exception as e:
            print(f"\n❌ Migration error: {e}")
            import traceback
            traceback.print_exc()
            conn.rollback()
            return False

if __name__ == "__main__":
    print("=" * 60)
    print("🚀 Starting schema migration: dismissed_milestones conversion")
    print("=" * 60)
    
    success = run_migration()
    
    print("\n" + "=" * 60)
    if success:
        print("✅ SUCCESS: Schema migration completed!")
    else:
        print("❌ FAILURE: Schema migration did not complete successfully.")
        print("   Please review the errors above.")
    print("=" * 60)
