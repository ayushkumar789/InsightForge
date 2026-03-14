"""
Clerk JWT authentication for InsightForge.
Verifies Clerk-issued JWTs and resolves users from MongoDB.
"""
import os
import uuid
import logging
import jwt
from datetime import datetime, timezone
from fastapi import Request, HTTPException
from database import db

logger = logging.getLogger(__name__)


def _get_public_key():
    """Load Clerk JWT public key from environment."""
    raw = os.environ.get("CLERK_JWT_PUBLIC_KEY", "")
    # Handle escaped newlines from .env
    raw = raw.replace("\\n", "\n")
    # Clean indentation whitespace from multi-line .env values
    lines = [line.strip() for line in raw.strip().splitlines()]
    return "\n".join(lines)


def _get_allowed_parties():
    """Load allowed azp (authorized parties) from environment."""
    raw = os.environ.get("CLERK_ALLOWED_PARTIES", "")
    if not raw:
        return None
    return [p.strip() for p in raw.split(",") if p.strip()]


def verify_clerk_token(token: str) -> dict:
    """Verify a Clerk JWT and return the decoded payload."""
    public_key = _get_public_key()
    if not public_key:
        raise HTTPException(status_code=500, detail="CLERK_JWT_PUBLIC_KEY not configured")

    try:
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        logger.error(f"JWT verification failed: {e}")
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

    # Optionally verify azp (authorized party) — log warning instead of blocking
    allowed = _get_allowed_parties()
    if allowed:
        azp = payload.get("azp", "")
        if azp and azp not in allowed:
            logger.warning(f"Token azp '{azp}' not in CLERK_ALLOWED_PARTIES {allowed} — allowing anyway")

    if not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Missing subject in token")

    return payload


async def get_or_create_user(clerk_user_id: str, email: str = None, name: str = None, picture: str = None) -> dict:
    """Find existing user by clerk_user_id, or create a new one."""
    user = await db.users.find_one({"clerk_user_id": clerk_user_id}, {"_id": 0})
    if user:
        return user

    # Auto-create user from Clerk identity
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    user_doc = {
        "user_id": user_id,
        "clerk_user_id": clerk_user_id,
        "email": email or "",
        "name": name or "",
        "picture": picture,
        "auth_provider": "clerk",
        "created_at": now,
    }
    await db.users.insert_one(user_doc)
    return {k: v for k, v in user_doc.items() if k != "_id"}


async def get_current_user(request: Request) -> dict:
    """FastAPI dependency: validates Clerk JWT from Authorization header and resolves user."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = auth_header[7:]
    payload = verify_clerk_token(token)
    clerk_user_id = payload["sub"]

    user = await db.users.find_one({"clerk_user_id": clerk_user_id}, {"_id": 0})
    if not user:
        user = await get_or_create_user(clerk_user_id)

    return user
