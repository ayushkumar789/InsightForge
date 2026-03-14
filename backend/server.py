from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pathlib import Path
import os
import logging

load_dotenv(Path(__file__).parent / ".env")

from database import db, init_db
from routers.auth_router import router as auth_router
from routers.workspace_router import router as workspace_router
from routers.dataset_router import router as dataset_router
from routers.analysis_router import router as analysis_router
from routers.insights_router import router as insights_router
from routers.report_router import router as report_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="InsightForge API", version="1.0.0")

# CORS must be before routes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")

# Health check
@api_router.get("/")
async def root():
    return {"status": "ok", "service": "InsightForge API"}

# Include all sub-routers
api_router.include_router(auth_router)
api_router.include_router(workspace_router)
api_router.include_router(dataset_router)
api_router.include_router(analysis_router)
api_router.include_router(insights_router)
api_router.include_router(report_router)

app.include_router(api_router)


@app.on_event("startup")
async def startup():
    await init_db()
    # Ensure upload directories exist
    Path(os.environ.get("UPLOAD_DIR", "/app/uploads")).mkdir(parents=True, exist_ok=True)
    (Path(os.environ.get("UPLOAD_DIR", "/app/uploads")) / "datasets").mkdir(parents=True, exist_ok=True)
    (Path(os.environ.get("UPLOAD_DIR", "/app/uploads")) / "reports").mkdir(parents=True, exist_ok=True)
    logger.info("InsightForge API started")


@app.on_event("shutdown")
async def shutdown():
    from database import client
    client.close()
