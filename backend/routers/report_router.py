import uuid
import asyncio
import logging
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.responses import FileResponse

from database import db
from auth import get_current_user
from report_generator import generate_report_pdf

logger = logging.getLogger(__name__)
router = APIRouter(tags=["reports"])


def now_iso():
    return datetime.now(timezone.utc).isoformat()


async def _run_report_job(
    report_id: str, dataset_id: str, analysis_id: str, insight_id: str = None
):
    try:
        await db.reports.update_one(
            {"report_id": report_id}, {"$set": {"status": "generating"}}
        )

        ds = await db.datasets.find_one({"dataset_id": dataset_id}, {"_id": 0})
        project = await db.projects.find_one({"project_id": ds["project_id"]}, {"_id": 0})
        workspace = await db.workspaces.find_one(
            {"workspace_id": ds["workspace_id"]}, {"_id": 0}
        )
        analysis = await db.analysis_runs.find_one({"analysis_id": analysis_id}, {"_id": 0})
        insight = None
        if insight_id:
            insight = await db.insight_runs.find_one({"insight_id": insight_id}, {"_id": 0})

        loop = asyncio.get_event_loop()
        file_path = await loop.run_in_executor(
            None, generate_report_pdf,
            report_id, ds, project or {}, workspace or {}, analysis, insight
        )

        now = now_iso()
        await db.reports.update_one(
            {"report_id": report_id},
            {"$set": {"status": "completed", "file_path": file_path, "completed_at": now}}
        )
        logger.info(f"Report generated: {report_id}")

    except Exception as e:
        logger.error(f"Report failed {report_id}: {e}", exc_info=True)
        await db.reports.update_one(
            {"report_id": report_id},
            {"$set": {"status": "failed", "error_message": str(e)}}
        )


@router.post("/datasets/{dataset_id}/report")
async def generate_report(
    dataset_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    ds = await db.datasets.find_one({"dataset_id": dataset_id}, {"_id": 0})
    if not ds:
        raise HTTPException(404, "Dataset not found")
    if ds["status"] not in ("analysis_complete", "insights_generated"):
        raise HTTPException(400, "Complete analysis before generating report")

    analysis = await db.analysis_runs.find_one(
        {"dataset_id": dataset_id, "status": "completed"},
        {"_id": 0},
        sort=[("created_at", -1)],
    )
    if not analysis:
        raise HTTPException(400, "No completed analysis found")

    insight = await db.insight_runs.find_one(
        {"dataset_id": dataset_id, "status": "completed"},
        {"_id": 0},
        sort=[("created_at", -1)],
    )

    report_id = f"rep_{uuid.uuid4().hex[:12]}"
    now = now_iso()
    doc = {
        "report_id": report_id,
        "dataset_id": dataset_id,
        "analysis_id": analysis["analysis_id"],
        "insight_id": insight["insight_id"] if insight else None,
        "project_id": ds["project_id"],
        "workspace_id": ds["workspace_id"],
        "title": f"Analysis Report: {ds['name']}",
        "status": "pending",
        "file_path": None,
        "generated_by": current_user["user_id"],
        "created_at": now,
        "completed_at": None,
    }
    await db.reports.insert_one(doc)
    doc.pop("_id", None)

    background_tasks.add_task(
        _run_report_job, report_id, dataset_id,
        analysis["analysis_id"], insight["insight_id"] if insight else None
    )
    return doc


@router.get("/datasets/{dataset_id}/report")
async def get_report(dataset_id: str, current_user: dict = Depends(get_current_user)):
    report = await db.reports.find_one(
        {"dataset_id": dataset_id},
        {"_id": 0},
        sort=[("created_at", -1)],
    )
    if not report:
        raise HTTPException(404, "No report found for this dataset")
    return report


@router.get("/reports/{report_id}/download")
async def download_report(report_id: str, current_user: dict = Depends(get_current_user)):
    report = await db.reports.find_one({"report_id": report_id}, {"_id": 0})
    if not report:
        raise HTTPException(404, "Report not found")
    if report["status"] != "completed":
        raise HTTPException(400, f"Report is {report['status']}")

    file_path = report.get("file_path")
    if not file_path or not Path(file_path).exists():
        raise HTTPException(404, "Report file not found")

    return FileResponse(
        file_path,
        media_type="application/pdf",
        filename=f"report_{report_id}.pdf",
    )
