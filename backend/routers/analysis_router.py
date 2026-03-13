import uuid
import asyncio
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks

from database import db
from auth import get_current_user
from analysis_engine import run_analysis_sync

logger = logging.getLogger(__name__)
router = APIRouter(tags=["analysis"])


def now_iso():
    return datetime.now(timezone.utc).isoformat()


async def _run_analysis_job(dataset_id: str, analysis_id: str):
    """Background job: runs deterministic analysis and saves results."""
    loop = asyncio.get_event_loop()
    try:
        ds = await db.datasets.find_one({"dataset_id": dataset_id}, {"_id": 0})
        if not ds:
            return

        await db.datasets.update_one({"dataset_id": dataset_id}, {"$set": {"status": "processing"}})
        await db.analysis_runs.update_one(
            {"analysis_id": analysis_id}, {"$set": {"status": "running"}}
        )

        results = await loop.run_in_executor(
            None, run_analysis_sync, ds["file_path"], ds["file_type"]
        )

        now = now_iso()
        await db.analysis_runs.update_one(
            {"analysis_id": analysis_id},
            {"$set": {
                "status": "completed",
                "results": results,
                "completed_at": now,
                "dataset_version": ds.get("version", 1),
            }}
        )
        await db.datasets.update_one(
            {"dataset_id": dataset_id},
            {"$set": {
                "status": "analysis_complete",
                "row_count": results.get("row_count"),
                "column_count": results.get("column_count"),
                "columns": results.get("columns"),
                "updated_at": now,
            }}
        )
        logger.info(f"Analysis completed for dataset {dataset_id}")

    except Exception as e:
        logger.error(f"Analysis failed for {dataset_id}: {e}", exc_info=True)
        await db.analysis_runs.update_one(
            {"analysis_id": analysis_id},
            {"$set": {"status": "failed", "error_message": str(e)}}
        )
        await db.datasets.update_one(
            {"dataset_id": dataset_id}, {"$set": {"status": "failed"}}
        )


@router.post("/datasets/{dataset_id}/analyze")
async def trigger_analysis(
    dataset_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    ds = await db.datasets.find_one({"dataset_id": dataset_id}, {"_id": 0})
    if not ds:
        raise HTTPException(404, "Dataset not found")
    if ds["status"] == "processing":
        raise HTTPException(400, "Analysis already in progress")

    # Cancel any outdated previous runs
    await db.analysis_runs.update_many(
        {"dataset_id": dataset_id, "status": {"$in": ["pending", "running"]}},
        {"$set": {"status": "outdated"}}
    )

    analysis_id = f"ana_{uuid.uuid4().hex[:12]}"
    now = now_iso()
    await db.analysis_runs.insert_one({
        "analysis_id": analysis_id,
        "dataset_id": dataset_id,
        "project_id": ds["project_id"],
        "status": "pending",
        "results": None,
        "error_message": None,
        "dataset_version": ds.get("version", 1),
        "created_at": now,
        "completed_at": None,
    })

    background_tasks.add_task(_run_analysis_job, dataset_id, analysis_id)
    return {"analysis_id": analysis_id, "status": "pending", "message": "Analysis started"}


@router.get("/datasets/{dataset_id}/analysis")
async def get_analysis(dataset_id: str, current_user: dict = Depends(get_current_user)):
    # Return the most recent completed analysis
    run = await db.analysis_runs.find_one(
        {"dataset_id": dataset_id, "status": "completed"},
        {"_id": 0},
        sort=[("created_at", -1)],
    )
    if not run:
        # Check if there's a pending/running one
        pending = await db.analysis_runs.find_one(
            {"dataset_id": dataset_id, "status": {"$in": ["pending", "running"]}},
            {"_id": 0},
        )
        if pending:
            return pending
        failed = await db.analysis_runs.find_one(
            {"dataset_id": dataset_id, "status": "failed"},
            {"_id": 0},
            sort=[("created_at", -1)],
        )
        if failed:
            return failed
        raise HTTPException(404, "No analysis found for this dataset")
    return run
