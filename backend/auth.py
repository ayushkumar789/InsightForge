import os
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from fastapi import Request, HTTPException
from database import db

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def generate_session_token() -> str:
    return f"sess_{uuid.uuid4().hex}"


def session_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=7)


async def create_session(user_id: str) -> str:
    token = generate_session_token()
    expires = session_expiry()
    await db.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "expires_at": expires.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return token


async def get_current_user(request: Request) -> dict:
    """Dependency: validates session from cookie or Authorization header."""
    # 1. Cookie first
    session_token = request.cookies.get("session_token")
    # 2. Authorization header fallback
    if not session_token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            session_token = auth[7:]

    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await db.user_sessions.find_one(
        {"session_token": session_token}, {"_id": 0}
    )
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    # Check expiry
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user = await db.users.find_one(
        {"user_id": session["user_id"]}, {"_id": 0, "password_hash": 0}
    )
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user
