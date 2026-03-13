import uuid
import asyncio
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks

from database import db
from auth import get_current_user
from insights_engine import generate_insights

logger = logging.getLogger(__name__)
router = APIRouter(tags=["insights"])


def now_iso():
    return datetime.now(timezone.utc).isoformat()


async def _run_insights_job(dataset_id: str, insight_id: str, analysis_id: str):
    """Background job: generates AI insights using Gemini."""
    try:
        ds = await db.datasets.find_one({"dataset_id": dataset_id}, {"_id": 0})
        analysis = await db.analysis_runs.find_one({"analysis_id": analysis_id}, {"_id": 0})
        if not ds or not analysis:
            return

        await db.insight_runs.update_one(
            {"insight_id": insight_id}, {"$set": {"status": "running"}}
        )

        insights = await generate_insights(ds, analysis)

        now = now_iso()
        await db.insight_runs.update_one(
            {"insight_id": insight_id},
            {"$set": {
                "status": "completed",
                "insights": insights,
                "model_used": insights.get("model_used", "gemini-2.5-flash"),
                "completed_at": now,
            }}
        )
        await db.datasets.update_one(
            {"dataset_id": dataset_id},
            {"$set": {"status": "insights_generated", "updated_at": now}}
        )
        logger.info(f"Insights completed for dataset {dataset_id}")

    except Exception as e:
        logger.error(f"Insights failed for {dataset_id}: {e}", exc_info=True)
        await db.insight_runs.update_one(
            {"insight_id": insight_id},
            {"$set": {"status": "failed", "error_message": str(e)}}
        )


@router.post("/datasets/{dataset_id}/insights")
async def trigger_insights(
    dataset_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    ds = await db.datasets.find_one({"dataset_id": dataset_id}, {"_id": 0})
    if not ds:
        raise HTTPException(404, "Dataset not found")
    if ds["status"] not in ("analysis_complete", "insights_generated"):
        raise HTTPException(400, "Run analysis before generating insights")

    # Get the completed analysis
    analysis = await db.analysis_runs.find_one(
        {"dataset_id": dataset_id, "status": "completed"},
        {"_id": 0},
        sort=[("created_at", -1)],
    )
    if not analysis:
        raise HTTPException(400, "No completed analysis found")

    insight_id = f"ins_{uuid.uuid4().hex[:12]}"
    now = now_iso()
    await db.insight_runs.insert_one({
        "insight_id": insight_id,
        "dataset_id": dataset_id,
        "analysis_id": analysis["analysis_id"],
        "project_id": ds["project_id"],
        "status": "pending",
        "model_used": "gemini-2.5-flash",
        "insights": None,
        "error_message": None,
        "created_at": now,
        "completed_at": None,
    })

    background_tasks.add_task(_run_insights_job, dataset_id, insight_id, analysis["analysis_id"])
    return {"insight_id": insight_id, "status": "pending", "message": "Insight generation started"}


@router.get("/datasets/{dataset_id}/insights")
async def get_insights(dataset_id: str, current_user: dict = Depends(get_current_user)):
    run = await db.insight_runs.find_one(
        {"dataset_id": dataset_id, "status": "completed"},
        {"_id": 0},
        sort=[("created_at", -1)],
    )
    if not run:
        pending = await db.insight_runs.find_one(
            {"dataset_id": dataset_id, "status": {"$in": ["pending", "running"]}},
            {"_id": 0},
        )
        if pending:
            return pending
        failed = await db.insight_runs.find_one(
            {"dataset_id": dataset_id, "status": "failed"},
            {"_id": 0},
            sort=[("created_at", -1)],
        )
        if failed:
            return failed
        raise HTTPException(404, "No insights found for this dataset")
    return run
