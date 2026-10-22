from fastapi import APIRouter, Depends, HTTPException, status, Header, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator
from datetime import datetime, timedelta
import jwt
import os
import bcrypt
from database import get_db
from db_models import User
from core.rate_limiter import limiter
from typing import Optional

# JWT Configuration
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    import sys
    print("⚠️ WARNING: SECRET_KEY environment variable is not set — auth endpoints will raise 500 at request time.", file=sys.stderr)
    SECRET_KEY = "UNSET_SECRET_KEY_REPLACE_ME"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 7 * 24 * 60  # 7 days

# Router
router = APIRouter(prefix="/auth", tags=["auth"])

# Pydantic models
class UserRegister(BaseModel):
    email: str
    password: str
    full_name: str = None
    role: str = "student"  # student / teacher (admin assigned manually)

    @field_validator("password")
    @classmethod
    def password_policy(cls, v: str) -> str:
        # SEC-16: minimal strength policy on self-registration. Login is
        # untouched (existing accounts keep working); the admin update route
        # stays unrestricted so admins can set temporary passwords.
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 bytes (bcrypt limit)")
        if not any(c.isalpha() for c in v) or not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one letter and one digit")
        return v

class UserLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    email: str
    role: str

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str = None
    role: str
    created_at: datetime

    class Config:
        from_attributes = True

# Helper functions
def hash_password(password: str) -> str:
    """Hash a password"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(user_id: int, email: str, role: str) -> str:
    """Create JWT access token"""
    if SECRET_KEY == "UNSET_SECRET_KEY_REPLACE_ME":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server misconfiguration: SECRET_KEY is not set"
        )
    expires = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": expires
    }
    encoded_jwt = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> dict:
    """Verify and decode JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("user_id")
        email: str = payload.get("email")
        if user_id is None or email is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        return {"user_id": user_id, "email": email, "role": payload.get("role", "student")}
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired"
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

# Dependency to get current user from token
def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> User:
    """Get current authenticated user from Authorization header"""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    # Support "Bearer <token>" format
    token = authorization
    if authorization.lower().startswith("bearer "):
        token = authorization[7:]
    
    payload = verify_token(token)
    user = db.query(User).filter(User.id == payload["user_id"]).first()
    
    if not user:
        print(f"❌ [AUTH] User not found for user_id={payload['user_id']}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    return user


def get_optional_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Like get_current_user but returns None instead of raising 401."""
    if not authorization:
        return None
    token = authorization[7:] if authorization.lower().startswith("bearer ") else authorization
    if not token:
        return None
    try:
        payload = verify_token(token)
        return db.query(User).filter(User.id == payload["user_id"]).first()
    except Exception:
        return None


def require_role(*allowed_roles: str):
    """Dependency factory: raises 403 if the current user's role is not in allowed_roles."""
    def _checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role(s): {', '.join(allowed_roles)}"
            )
        return current_user
    return _checker


# Routes
@router.post("/register", response_model=Token)
@limiter.limit("5/minute")
async def register(request: Request, user_data: UserRegister, db: Session = Depends(get_db)):
    """Register a new user. All self-registrations are created as 'student';
    an admin promotes accounts to teacher/admin (SEC-7)."""
    # Self-registration must not grant elevated roles. The role field is still
    # accepted for client compatibility but anything but 'student' is rejected.
    if user_data.role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Self-registration is student-only; an admin assigns other roles."
        )

    # Check if email already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )

    # Create new user
    hashed_password = hash_password(user_data.password)
    new_user = User(
        email=user_data.email,
        password_hash=hashed_password,
        full_name=user_data.full_name,
        role="student"
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Create token
    token = create_access_token(new_user.id, new_user.email, new_user.role)
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": new_user.id,
        "email": new_user.email,
        "role": new_user.role
    }

@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
async def login(request: Request, user_data: UserLogin, db: Session = Depends(get_db)):
    """Login user. SEC-14: rate-limited per client IP to slow credential
    stuffing; behind a proxy the key is the proxy IP until SEC-15 is fixed."""
    # Find user by email
    user = db.query(User).filter(User.email == user_data.email).first()
    
    if not user or not verify_password(user_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Create token
    token = create_access_token(user.id, user.email, user.role)
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user.id,
        "email": user.email,
        "role": user.role
    }

@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user)
):
    """Get current user profile"""
    return current_user

@router.post("/refresh")
async def refresh_token(
    current_user: User = Depends(get_current_user)
):
    """Refresh access token"""
    new_token = create_access_token(current_user.id, current_user.email, current_user.role)
    
    return {
        "access_token": new_token,
        "token_type": "bearer",
        "user_id": current_user.id,
        "email": current_user.email,
        "role": current_user.role
    }
