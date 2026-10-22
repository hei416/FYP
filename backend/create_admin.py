"""
One-time script to create an admin account directly in the database.
Usage:
    python create_admin.py
    python create_admin.py --email admin@example.com --password secret --name "Admin User"

Never expose this script via an HTTP endpoint.
"""
import argparse
import sys

import bcrypt
from sqlalchemy.orm import Session

from database import SessionLocal
from db_models import User


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def create_admin(
    email: str,
    password: str,
    full_name: str,
    db: Session,
) -> None:
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        print(f"[!] A user with email '{email}' already exists (role: {existing.role}).")
        print("    To promote them to admin, update their role directly:")
        print(f"    UPDATE users SET role='admin' WHERE email='{email}';")
        sys.exit(1)

    admin = User(
        email=email,
        password_hash=hash_password(password),
        full_name=full_name,
        role="admin",
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    print(f"[+] Admin account created successfully.")
    print(f"    ID   : {admin.id}")
    print(f"    Email: {admin.email}")
    print(f"    Name : {admin.full_name}")
    print(f"    Role : {admin.role}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create an admin user in the CodeTutor database.")
    parser.add_argument("--email",    default="admin@codetutor.app", help="Admin email address")
    parser.add_argument("--password", default=None,                  help="Admin password (prompted if omitted)")
    parser.add_argument("--name",     default="Admin",               help="Admin full name")
    args = parser.parse_args()

    if not args.password:
        import getpass
        args.password = getpass.getpass("Enter admin password: ")
        confirm = getpass.getpass("Confirm admin password: ")
        if args.password != confirm:
            print("[!] Passwords do not match.")
            sys.exit(1)

    if len(args.password) < 8:
        print("[!] Password must be at least 8 characters.")
        sys.exit(1)

    db = SessionLocal()
    try:
        create_admin(args.email, args.password, args.name, db)
    finally:
        db.close()
