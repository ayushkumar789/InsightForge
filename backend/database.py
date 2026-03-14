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
    # Drop old conflicting indexes if they exist
    try:
        await db.users.drop_index("email_1")
    except Exception:
        pass
    await db.users.create_index("email", unique=True, sparse=True)
    await db.users.create_index("clerk_user_id", unique=True, sparse=True)
    await db.workspaces.create_index("owner_id")
    await db.projects.create_index("workspace_id")
    await db.datasets.create_index("project_id")
    await db.analysis_runs.create_index("dataset_id")
    await db.insight_runs.create_index("dataset_id")
    await db.reports.create_index("dataset_id")
