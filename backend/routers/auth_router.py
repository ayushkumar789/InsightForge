import uuid
import requests
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Response, Request, Depends
from fastapi.responses import JSONResponse

from database import db
from auth import hash_password, verify_password, create_session, get_current_user
from models import UserCreate, UserLogin, GoogleSessionExchange, ProfileUpdate, PasswordChange

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup")
async def signup(body: UserCreate, response: Response):
    if await db.users.find_one({"email": body.email}, {"_id": 0}):
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = f"user_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    await db.users.insert_one({
        "user_id": user_id,
        "email": body.email,
        "name": body.name,
        "picture": None,
        "auth_provider": "jwt",
        "password_hash": hash_password(body.password),
        "created_at": now,
    })

    token = await create_session(user_id)
    response.set_cookie(
        "session_token", token, httponly=True,
        secure=True, samesite="none", path="/", max_age=604800
    )
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return {"user": user, "session_token": token}


@router.post("/login")
async def login(body: UserLogin, response: Response):
    user = await db.users.find_one({"email": body.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.get("auth_provider") == "google":
        raise HTTPException(status_code=400, detail="Please login with Google")
    if not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = await create_session(user["user_id"])
    response.set_cookie(
        "session_token", token, httponly=True,
        secure=True, samesite="none", path="/", max_age=604800
    )
    safe_user = {k: v for k, v in user.items() if k != "password_hash"}
    return {"user": safe_user, "session_token": token}


@router.post("/google")
async def google_oauth(body: GoogleSessionExchange, response: Response):
    """Exchange Emergent Auth session_id for app session."""
    try:
        res = requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": body.session_id},
            timeout=10,
        )
        if not res.ok:
            raise HTTPException(status_code=400, detail="Invalid OAuth session")
        data = res.json()
    except requests.RequestException:
        raise HTTPException(status_code=500, detail="OAuth provider unreachable")

    email = data.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="No email from OAuth provider")

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        # Update profile picture if changed
        if data.get("picture") and data["picture"] != existing.get("picture"):
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {"picture": data["picture"], "name": data.get("name", existing["name"])}}
            )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": data.get("name", email.split("@")[0]),
            "picture": data.get("picture"),
            "auth_provider": "google",
            "created_at": now,
        })

    token = await create_session(user_id)
    response.set_cookie(
        "session_token", token, httponly=True,
        secure=True, samesite="none", path="/", max_age=604800
    )
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return {"user": user, "session_token": token}


@router.get("/me")
async def me(current_user: dict = Depends(get_current_user)):
    return current_user


@router.post("/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"message": "Logged out"}


@router.put("/profile")
async def update_profile(body: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": {"name": body.name}}
    )
    return {"message": "Profile updated"}


@router.post("/change-password")
async def change_password(body: PasswordChange, current_user: dict = Depends(get_current_user)):
    if current_user.get("auth_provider") == "google":
        raise HTTPException(status_code=400, detail="Cannot change password for Google accounts")
    user = await db.users.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
    if not verify_password(body.current_password, user.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": {"password_hash": hash_password(body.new_password)}}
    )
    return {"message": "Password updated"}
