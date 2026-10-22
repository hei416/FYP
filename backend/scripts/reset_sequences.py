#!/usr/bin/env python3
"""Reset PostgreSQL serial sequences to match the max `id` in tables.

Usage examples:
  # Use DATABASE_URL env var
  python scripts/reset_sequences.py --tables users,user_progress

  # Reset all tables in public schema that have an `id` column
  python scripts/reset_sequences.py --all

  # Provide a DB URL explicitly
  python scripts/reset_sequences.py --db-url postgresql://user:pass@host:5432/dbname --all
"""
import argparse
import os
import sys
from urllib.parse import urlparse

import psycopg2
from psycopg2 import sql


def is_postgres_url(url: str) -> bool:
    parsed = urlparse(url)
    return parsed.scheme.startswith("postgres")


def run_for_tables(conn, tables):
    with conn.cursor() as cur:
        for tbl in tables:
            print(f"Resetting sequence for table: {tbl}")
            # Use Identifier to safely interpolate table names
            query = sql.SQL(
                "SELECT setval(pg_get_serial_sequence(%s, 'id'), COALESCE((SELECT MAX(id) FROM {tbl}), 1))"
            ).format(tbl=sql.Identifier(tbl))
            cur.execute(query, (tbl,))
            # Fetch result to display new sequence value
            try:
                val = cur.fetchone()
                print(" ->", val)
            except Exception:
                conn.commit()
        conn.commit()


def run_for_all(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT table_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND column_name = 'id'
            """
        )
        tables = [row[0] for row in cur.fetchall()]
    run_for_tables(conn, tables)


def main():
    parser = argparse.ArgumentParser(description="Reset Postgres serial sequences to match table max(id)")
    parser.add_argument("--db-url", help="Database URL (overrides DATABASE_URL env var)")
    parser.add_argument("--tables", help="Comma-separated list of tables to reset")
    parser.add_argument("--all", action="store_true", help="Reset all tables in public schema that have an `id` column")
    args = parser.parse_args()

    db_url = args.db_url or os.environ.get("DATABASE_URL")
    if not db_url:
        print("No DATABASE_URL provided via --db-url or DATABASE_URL env var. Aborting.")
        sys.exit(2)

    if not is_postgres_url(db_url):
        print("The provided DATABASE_URL does not look like Postgres. This script only supports Postgres. Aborting.")
        sys.exit(3)

    try:
        conn = psycopg2.connect(db_url)
    except Exception as e:
        print("Failed to connect to the database:", e)
        sys.exit(4)

    try:
        if args.all:
            run_for_all(conn)
        elif args.tables:
            tables = [t.strip() for t in args.tables.split(",") if t.strip()]
            if not tables:
                print("No valid tables provided in --tables")
                sys.exit(2)
            run_for_tables(conn, tables)
        else:
            print("Nothing to do. Provide --tables or --all")
            sys.exit(2)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
