import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]


async def init_db():
    """Create MongoDB indexes for performance"""
    await db.users.create_index("email", unique=True)
    await db.user_sessions.create_index("session_token")
    await db.user_sessions.create_index("user_id")
    await db.workspaces.create_index("owner_id")
    await db.projects.create_index("workspace_id")
    await db.datasets.create_index("project_id")
    await db.analysis_runs.create_index("dataset_id")
    await db.insight_runs.create_index("dataset_id")
    await db.reports.create_index("dataset_id")
