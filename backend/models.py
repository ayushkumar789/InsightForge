from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid


def new_id() -> str:
    return str(uuid.uuid4())


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


# ── Auth Models ──────────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    auth_provider: str
    created_at: datetime


# ── Workspace Models ──────────────────────────────────────────────────────────

class WorkspaceMember(BaseModel):
    user_id: str
    role: str  # owner | editor | viewer
    added_at: datetime = Field(default_factory=now_utc)


class WorkspaceCreate(BaseModel):
    name: str


class WorkspaceUpdate(BaseModel):
    name: str


class WorkspaceResponse(BaseModel):
    workspace_id: str
    name: str
    owner_id: str
    members: List[Dict] = []
    created_at: datetime
    updated_at: datetime
    project_count: Optional[int] = 0


# ── Project Models ────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class ProjectResponse(BaseModel):
    project_id: str
    workspace_id: str
    name: str
    description: Optional[str] = None
    owner_id: str
    created_at: datetime
    updated_at: datetime
    dataset_count: Optional[int] = 0


# ── Dataset Models ────────────────────────────────────────────────────────────

class DatasetResponse(BaseModel):
    dataset_id: str
    project_id: str
    workspace_id: str
    name: str
    original_filename: str
    file_type: str
    file_size: int
    status: str
    row_count: Optional[int] = None
    column_count: Optional[int] = None
    columns: Optional[List[str]] = None
    version: int = 1
    uploaded_by: str
    created_at: datetime
    updated_at: datetime


class DatasetPreview(BaseModel):
    dataset_id: str
    name: str
    original_filename: str
    file_type: str
    row_count: Optional[int]
    column_count: Optional[int]
    columns: Optional[List[str]]
    dtypes: Optional[Dict[str, str]]
    preview_rows: Optional[List[Dict]]
    sheets: Optional[List[str]] = None
    parse_error: Optional[str] = None


# ── Analysis Models ───────────────────────────────────────────────────────────

class AnalysisResponse(BaseModel):
    analysis_id: str
    dataset_id: str
    project_id: str
    status: str
    results: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    dataset_version: int = 1
    created_at: datetime
    completed_at: Optional[datetime] = None


# ── Insight Models ────────────────────────────────────────────────────────────

class InsightResponse(BaseModel):
    insight_id: str
    dataset_id: str
    analysis_id: str
    project_id: str
    status: str
    model_used: str
    insights: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None


# ── Report Models ─────────────────────────────────────────────────────────────

class ReportResponse(BaseModel):
    report_id: str
    dataset_id: str
    analysis_id: str
    insight_id: Optional[str] = None
    project_id: str
    workspace_id: str
    title: str
    status: str
    generated_by: str
    created_at: datetime
    completed_at: Optional[datetime] = None


# ── Dashboard Models ──────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_workspaces: int = 0
    total_projects: int = 0
    total_datasets: int = 0
    datasets_processed: int = 0
    insights_generated: int = 0


class ProjectStats(BaseModel):
    total_datasets: int = 0
    uploaded: int = 0
    processing: int = 0
    analysis_complete: int = 0
    insights_generated: int = 0
    failed: int = 0
    outdated: int = 0


# ── Profile Update ────────────────────────────────────────────────────────────

class ProfileUpdate(BaseModel):
    name: str
