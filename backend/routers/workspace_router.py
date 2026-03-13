import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends

from database import db
from auth import get_current_user
from models import (
    WorkspaceCreate, WorkspaceUpdate,
    ProjectCreate, ProjectUpdate,
)

router = APIRouter(tags=["workspaces"])


def now_iso():
    return datetime.now(timezone.utc).isoformat()


# ── Workspaces ────────────────────────────────────────────────────────────────

@router.get("/workspaces")
async def list_workspaces(current_user: dict = Depends(get_current_user)):
    docs = await db.workspaces.find(
        {"owner_id": current_user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)

    for ws in docs:
        ws["project_count"] = await db.projects.count_documents({"workspace_id": ws["workspace_id"]})
    return docs


@router.post("/workspaces", status_code=201)
async def create_workspace(body: WorkspaceCreate, current_user: dict = Depends(get_current_user)):
    ws_id = f"ws_{uuid.uuid4().hex[:12]}"
    now = now_iso()
    doc = {
        "workspace_id": ws_id,
        "name": body.name,
        "owner_id": current_user["user_id"],
        "members": [{"user_id": current_user["user_id"], "role": "owner", "added_at": now}],
        "created_at": now,
        "updated_at": now,
    }
    await db.workspaces.insert_one(doc)
    doc.pop("_id", None)
    doc["project_count"] = 0
    return doc


@router.get("/workspaces/{workspace_id}")
async def get_workspace(workspace_id: str, current_user: dict = Depends(get_current_user)):
    ws = await db.workspaces.find_one(
        {"workspace_id": workspace_id, "owner_id": current_user["user_id"]}, {"_id": 0}
    )
    if not ws:
        raise HTTPException(404, "Workspace not found")
    ws["project_count"] = await db.projects.count_documents({"workspace_id": workspace_id})
    return ws


@router.put("/workspaces/{workspace_id}")
async def update_workspace(
    workspace_id: str, body: WorkspaceUpdate, current_user: dict = Depends(get_current_user)
):
    result = await db.workspaces.update_one(
        {"workspace_id": workspace_id, "owner_id": current_user["user_id"]},
        {"$set": {"name": body.name, "updated_at": now_iso()}}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Workspace not found")
    return {"message": "Updated"}


@router.delete("/workspaces/{workspace_id}")
async def delete_workspace(workspace_id: str, current_user: dict = Depends(get_current_user)):
    ws = await db.workspaces.find_one(
        {"workspace_id": workspace_id, "owner_id": current_user["user_id"]}, {"_id": 0}
    )
    if not ws:
        raise HTTPException(404, "Workspace not found")

    # Cascade delete projects → datasets → analysis → insights → reports
    projects = await db.projects.find({"workspace_id": workspace_id}, {"project_id": 1}).to_list(1000)
    for p in projects:
        pid = p["project_id"]
        datasets = await db.datasets.find({"project_id": pid}, {"dataset_id": 1}).to_list(1000)
        for d in datasets:
            did = d["dataset_id"]
            await db.analysis_runs.delete_many({"dataset_id": did})
            await db.insight_runs.delete_many({"dataset_id": did})
            await db.reports.delete_many({"dataset_id": did})
        await db.datasets.delete_many({"project_id": pid})
    await db.projects.delete_many({"workspace_id": workspace_id})
    await db.workspaces.delete_one({"workspace_id": workspace_id})
    return {"message": "Workspace deleted"}


# ── Projects ──────────────────────────────────────────────────────────────────

@router.get("/workspaces/{workspace_id}/projects")
async def list_projects(workspace_id: str, current_user: dict = Depends(get_current_user)):
    ws = await db.workspaces.find_one(
        {"workspace_id": workspace_id, "owner_id": current_user["user_id"]}, {"_id": 0}
    )
    if not ws:
        raise HTTPException(404, "Workspace not found")
    docs = await db.projects.find(
        {"workspace_id": workspace_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)

    for p in docs:
        p["dataset_count"] = await db.datasets.count_documents({"project_id": p["project_id"]})
    return docs


@router.post("/workspaces/{workspace_id}/projects", status_code=201)
async def create_project(
    workspace_id: str, body: ProjectCreate, current_user: dict = Depends(get_current_user)
):
    ws = await db.workspaces.find_one(
        {"workspace_id": workspace_id, "owner_id": current_user["user_id"]}, {"_id": 0}
    )
    if not ws:
        raise HTTPException(404, "Workspace not found")

    p_id = f"proj_{uuid.uuid4().hex[:12]}"
    now = now_iso()
    doc = {
        "project_id": p_id,
        "workspace_id": workspace_id,
        "name": body.name,
        "description": body.description,
        "owner_id": current_user["user_id"],
        "created_at": now,
        "updated_at": now,
    }
    await db.projects.insert_one(doc)
    doc.pop("_id", None)
    doc["dataset_count"] = 0
    return doc


@router.get("/projects/{project_id}")
async def get_project(project_id: str, current_user: dict = Depends(get_current_user)):
    p = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Project not found")
    p["dataset_count"] = await db.datasets.count_documents({"project_id": project_id})
    return p


@router.put("/projects/{project_id}")
async def update_project(
    project_id: str, body: ProjectUpdate, current_user: dict = Depends(get_current_user)
):
    update = {"updated_at": now_iso()}
    if body.name is not None:
        update["name"] = body.name
    if body.description is not None:
        update["description"] = body.description
    result = await db.projects.update_one({"project_id": project_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(404, "Project not found")
    return {"message": "Updated"}


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str, current_user: dict = Depends(get_current_user)):
    p = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Project not found")
    datasets = await db.datasets.find({"project_id": project_id}, {"dataset_id": 1}).to_list(1000)
    for d in datasets:
        did = d["dataset_id"]
        await db.analysis_runs.delete_many({"dataset_id": did})
        await db.insight_runs.delete_many({"dataset_id": did})
        await db.reports.delete_many({"dataset_id": did})
    await db.datasets.delete_many({"project_id": project_id})
    await db.projects.delete_one({"project_id": project_id})
    return {"message": "Project deleted"}


@router.get("/projects/{project_id}/stats")
async def project_stats(project_id: str, current_user: dict = Depends(get_current_user)):
    pipeline = [
        {"$match": {"project_id": project_id}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    results = await db.datasets.aggregate(pipeline).to_list(20)
    stats = {item["_id"]: item["count"] for item in results}
    total = sum(stats.values())
    return {
        "total_datasets": total,
        "uploaded": stats.get("uploaded", 0),
        "processing": stats.get("processing", 0),
        "analysis_complete": stats.get("analysis_complete", 0),
        "insights_generated": stats.get("insights_generated", 0),
        "failed": stats.get("failed", 0),
        "outdated": stats.get("outdated", 0),
    }


@router.get("/dashboard/stats")
async def dashboard_stats(current_user: dict = Depends(get_current_user)):
    uid = current_user["user_id"]
    ws_count = await db.workspaces.count_documents({"owner_id": uid})
    proj_count = await db.projects.count_documents({"owner_id": uid})
    total_datasets = await db.datasets.count_documents({"uploaded_by": uid})
    processed = await db.datasets.count_documents({
        "uploaded_by": uid,
        "status": {"$in": ["analysis_complete", "insights_generated"]}
    })
    insights_gen = await db.datasets.count_documents(
        {"uploaded_by": uid, "status": "insights_generated"}
    )
    # Recent datasets
    recent = await db.datasets.find(
        {"uploaded_by": uid}, {"_id": 0}
    ).sort("created_at", -1).to_list(5)

    return {
        "total_workspaces": ws_count,
        "total_projects": proj_count,
        "total_datasets": total_datasets,
        "datasets_processed": processed,
        "insights_generated": insights_gen,
        "recent_datasets": recent,
    }
