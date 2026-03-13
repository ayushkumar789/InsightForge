import uuid
import asyncio
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks

from database import db
from auth import get_current_user
from analysis_engine import run_analysis_sync

logger = logging.getLogger(__name__)
router = APIRouter(tags=["datasets"])

UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "/app/uploads"))
DATASETS_DIR = UPLOAD_DIR / "datasets"
DATASETS_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_TYPES = {"csv": "text/csv", "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def detect_file_type(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext == "csv":
        return "csv"
    elif ext in ("xlsx", "xls"):
        return "xlsx"
    return ""


@router.get("/projects/{project_id}/datasets")
async def list_datasets(project_id: str, current_user: dict = Depends(get_current_user)):
    docs = await db.datasets.find(
        {"project_id": project_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    return docs


@router.post("/datasets", status_code=201)
async def upload_dataset(
    project_id: str = Form(...),
    name: str = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    file_type = detect_file_type(file.filename)
    if not file_type:
        raise HTTPException(400, "Only CSV and XLSX files are supported")

    # Verify project exists
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(404, "Project not found")

    # Read file content
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(400, "File too large. Maximum size is 50 MB")
    if len(content) == 0:
        raise HTTPException(400, "File is empty")

    dataset_id = f"ds_{uuid.uuid4().hex[:12]}"
    ds_dir = DATASETS_DIR / dataset_id
    ds_dir.mkdir(parents=True, exist_ok=True)
    file_path = str(ds_dir / file.filename)

    with open(file_path, "wb") as f:
        f.write(content)

    now = now_iso()
    doc = {
        "dataset_id": dataset_id,
        "project_id": project_id,
        "workspace_id": project["workspace_id"],
        "name": name,
        "original_filename": file.filename,
        "file_type": file_type,
        "file_size": len(content),
        "file_path": file_path,
        "status": "uploaded",
        "row_count": None,
        "column_count": None,
        "columns": None,
        "version": 1,
        "uploaded_by": current_user["user_id"],
        "created_at": now,
        "updated_at": now,
    }

    # Try quick metadata scan
    try:
        import pandas as pd
        if file_type == "csv":
            df = pd.read_csv(file_path, nrows=5)
        else:
            df = pd.read_excel(file_path, nrows=5, engine="openpyxl")
        # Get full row count separately
        if file_type == "csv":
            full_df = pd.read_csv(file_path, low_memory=False)
        else:
            full_df = pd.read_excel(file_path, engine="openpyxl")
        doc["row_count"] = len(full_df)
        doc["column_count"] = len(df.columns)
        doc["columns"] = df.columns.tolist()
    except Exception:
        pass

    await db.datasets.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/datasets/{dataset_id}")
async def get_dataset(dataset_id: str, current_user: dict = Depends(get_current_user)):
    doc = await db.datasets.find_one({"dataset_id": dataset_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Dataset not found")
    return doc


@router.delete("/datasets/{dataset_id}")
async def delete_dataset(dataset_id: str, current_user: dict = Depends(get_current_user)):
    ds = await db.datasets.find_one({"dataset_id": dataset_id}, {"_id": 0})
    if not ds:
        raise HTTPException(404, "Dataset not found")

    # Remove file
    try:
        Path(ds["file_path"]).parent.rmdir() if Path(ds["file_path"]).parent.exists() else None
    except Exception:
        pass

    await db.analysis_runs.delete_many({"dataset_id": dataset_id})
    await db.insight_runs.delete_many({"dataset_id": dataset_id})
    await db.reports.delete_many({"dataset_id": dataset_id})
    await db.datasets.delete_one({"dataset_id": dataset_id})
    return {"message": "Dataset deleted"}


@router.put("/datasets/{dataset_id}/replace")
async def replace_dataset(
    dataset_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    ds = await db.datasets.find_one({"dataset_id": dataset_id}, {"_id": 0})
    if not ds:
        raise HTTPException(404, "Dataset not found")

    file_type = detect_file_type(file.filename)
    if not file_type:
        raise HTTPException(400, "Only CSV and XLSX files are supported")

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(400, "File is empty")

    # Save new file (replace old)
    ds_dir = DATASETS_DIR / dataset_id
    ds_dir.mkdir(parents=True, exist_ok=True)
    file_path = str(ds_dir / file.filename)
    with open(file_path, "wb") as f:
        f.write(content)

    # Invalidate previous analysis & insights
    await db.analysis_runs.update_many(
        {"dataset_id": dataset_id},
        {"$set": {"status": "outdated"}}
    )
    await db.insight_runs.update_many(
        {"dataset_id": dataset_id},
        {"$set": {"status": "outdated"}}
    )

    update = {
        "original_filename": file.filename,
        "file_type": file_type,
        "file_size": len(content),
        "file_path": file_path,
        "status": "uploaded",
        "row_count": None,
        "column_count": None,
        "columns": None,
        "version": ds.get("version", 1) + 1,
        "updated_at": now_iso(),
    }

    # Quick scan
    try:
        import pandas as pd
        if file_type == "csv":
            full_df = pd.read_csv(file_path, low_memory=False)
        else:
            full_df = pd.read_excel(file_path, engine="openpyxl")
        update["row_count"] = len(full_df)
        update["column_count"] = len(full_df.columns)
        update["columns"] = full_df.columns.tolist()
    except Exception:
        pass

    await db.datasets.update_one({"dataset_id": dataset_id}, {"$set": update})
    updated = await db.datasets.find_one({"dataset_id": dataset_id}, {"_id": 0})
    return updated


@router.get("/datasets/{dataset_id}/preview")
async def preview_dataset(
    dataset_id: str,
    sheet: str = None,
    current_user: dict = Depends(get_current_user),
):
    ds = await db.datasets.find_one({"dataset_id": dataset_id}, {"_id": 0})
    if not ds:
        raise HTTPException(404, "Dataset not found")

    try:
        import pandas as pd
        file_path = ds["file_path"]
        sheets = None

        if ds["file_type"] == "csv":
            try:
                df = pd.read_csv(file_path, low_memory=False)
            except UnicodeDecodeError:
                df = pd.read_csv(file_path, encoding="latin-1", low_memory=False)
        else:
            xl = pd.ExcelFile(file_path, engine="openpyxl")
            sheets = xl.sheet_names
            target = sheet if (sheet and sheet in sheets) else sheets[0]
            df = xl.parse(target)

        preview_rows = df.head(20).fillna("").astype(str).to_dict("records")
        dtypes = {col: str(dtype) for col, dtype in df.dtypes.items()}

        return {
            "dataset_id": dataset_id,
            "name": ds["name"],
            "original_filename": ds["original_filename"],
            "file_type": ds["file_type"],
            "row_count": len(df),
            "column_count": len(df.columns),
            "columns": df.columns.tolist(),
            "dtypes": dtypes,
            "preview_rows": preview_rows,
            "sheets": sheets,
            "parse_error": None,
        }
    except Exception as e:
        return {
            "dataset_id": dataset_id,
            "name": ds["name"],
            "original_filename": ds["original_filename"],
            "file_type": ds["file_type"],
            "row_count": None,
            "column_count": None,
            "columns": None,
            "dtypes": None,
            "preview_rows": None,
            "sheets": None,
            "parse_error": str(e),
        }
