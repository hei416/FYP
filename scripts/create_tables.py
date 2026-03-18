#!/usr/bin/env python3
"""Create any missing tables defined in `db_models.py` using the project's DB config.
Run: `source .venv/bin/activate && python scripts/create_tables.py`
"""
import sys
import os
from pathlib import Path

# Ensure project root is on sys.path so `import database` works when run from scripts/
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from database import get_engine, Base
import db_models  # ensure models are imported so they are registered on Base


def main():
    engine = get_engine()
    print("Creating missing tables (if any) using DATABASE_URL:", engine.url)
    Base.metadata.create_all(bind=engine)
    print("Done. Tables created/verified.")


if __name__ == '__main__':
    main()
