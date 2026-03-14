import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional

from database import db
from auth import get_current_user, verify_clerk_token, get_or_create_user

router = APIRouter(prefix="/auth", tags=["auth"])


class UserSyncBody(BaseModel):
    email: str
    name: Optional[str] = ""
    picture: Optional[str] = None


class ProfileUpdate(BaseModel):
    name: str


@router.post("/sync")
async def sync_user(body: UserSyncBody, request: Request):
    """Sync Clerk user to local database. Called by frontend after Clerk sign-in."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = auth_header[7:]
    payload = verify_clerk_token(token)
    clerk_user_id = payload["sub"]

    existing = await db.users.find_one({"clerk_user_id": clerk_user_id}, {"_id": 0})
    if existing:
        update_fields = {}
        if body.email and body.email != existing.get("email"):
            update_fields["email"] = body.email
        if body.name and body.name != existing.get("name"):
            update_fields["name"] = body.name
        if body.picture and body.picture != existing.get("picture"):
            update_fields["picture"] = body.picture
        if update_fields:
            await db.users.update_one(
                {"clerk_user_id": clerk_user_id},
                {"$set": update_fields}
            )
        user = await db.users.find_one({"clerk_user_id": clerk_user_id}, {"_id": 0})
    else:
        user = await get_or_create_user(
            clerk_user_id,
            email=body.email,
            name=body.name or body.email.split("@")[0],
            picture=body.picture,
        )

    return {
        "user_id": user.get("user_id"),
        "email": user.get("email"),
        "name": user.get("name"),
        "synced": True,
    }


@router.get("/me")
async def me(current_user: dict = Depends(get_current_user)):
    return current_user


@router.put("/profile")
async def update_profile(body: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": {"name": body.name}}
    )
    return {"message": "Profile updated"}
