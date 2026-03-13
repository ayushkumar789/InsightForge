"""InsightForge API Backend Tests"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials
TEST_EMAIL = "test@insightforge.com"
TEST_PASSWORD = "testpass123"


@pytest.fixture(scope="session")
def session_token():
    """Login and get session token"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    if resp.status_code == 401:
        # Try signup
        resp2 = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "email": TEST_EMAIL, "password": TEST_PASSWORD, "name": "Test User"
        })
        if resp2.status_code in (200, 201):
            return resp2.json()["session_token"]
        pytest.skip(f"Auth failed: {resp2.text}")
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["session_token"]


@pytest.fixture(scope="session")
def auth_headers(session_token):
    return {"Authorization": f"Bearer {session_token}"}


# ── Auth Tests ────────────────────────────────────────────────────────────────

class TestAuth:
    def test_health(self):
        resp = requests.get(f"{BASE_URL}/api/")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    def test_login(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
        assert resp.status_code == 200
        data = resp.json()
        assert "session_token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL

    def test_me(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == TEST_EMAIL

    def test_login_wrong_password(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": TEST_EMAIL, "password": "wrongpass"})
        assert resp.status_code == 401

    def test_me_unauthenticated(self):
        resp = requests.get(f"{BASE_URL}/api/auth/me")
        assert resp.status_code in (401, 403)


# ── Workspace Tests ───────────────────────────────────────────────────────────

class TestWorkspaces:
    ws_id = None

    def test_list_workspaces(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/workspaces", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_create_workspace(self, auth_headers):
        resp = requests.post(f"{BASE_URL}/api/workspaces", json={"name": "TEST_Workspace"}, headers=auth_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "TEST_Workspace"
        assert "workspace_id" in data
        TestWorkspaces.ws_id = data["workspace_id"]

    def test_get_workspace(self, auth_headers):
        if not TestWorkspaces.ws_id:
            pytest.skip("No workspace_id")
        resp = requests.get(f"{BASE_URL}/api/workspaces/{TestWorkspaces.ws_id}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["workspace_id"] == TestWorkspaces.ws_id

    def test_create_project_in_workspace(self, auth_headers):
        if not TestWorkspaces.ws_id:
            pytest.skip("No workspace_id")
        resp = requests.post(
            f"{BASE_URL}/api/workspaces/{TestWorkspaces.ws_id}/projects",
            json={"name": "TEST_Project", "description": "Test project"},
            headers=auth_headers
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "TEST_Project"
        TestWorkspaces.proj_id = data["project_id"]

    def test_project_stats(self, auth_headers):
        if not hasattr(TestWorkspaces, "proj_id") or not TestWorkspaces.proj_id:
            pytest.skip("No project_id")
        resp = requests.get(f"{BASE_URL}/api/projects/{TestWorkspaces.proj_id}/stats", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "total_datasets" in data

    def test_dashboard_stats(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "total_workspaces" in data
        assert "total_datasets" in data


# ── Dataset Tests ─────────────────────────────────────────────────────────────

class TestDatasets:
    ds_id = None

    def test_upload_csv(self, auth_headers):
        if not hasattr(TestWorkspaces, "proj_id") or not TestWorkspaces.proj_id:
            pytest.skip("No project_id")
        csv_content = b"name,age,salary\nAlice,30,50000\nBob,25,45000\nCarol,35,60000\n"
        files = {"file": ("test_data.csv", io.BytesIO(csv_content), "text/csv")}
        data = {"project_id": TestWorkspaces.proj_id, "name": "TEST_Dataset"}
        resp = requests.post(f"{BASE_URL}/api/datasets", data=data, files=files, headers=auth_headers)
        assert resp.status_code == 201
        result = resp.json()
        assert result["status"] == "uploaded"
        assert result["row_count"] == 3
        assert result["column_count"] == 3
        TestDatasets.ds_id = result["dataset_id"]

    def test_get_dataset(self, auth_headers):
        if not TestDatasets.ds_id:
            pytest.skip("No dataset_id")
        resp = requests.get(f"{BASE_URL}/api/datasets/{TestDatasets.ds_id}", headers=auth_headers)
        assert resp.status_code == 200

    def test_list_datasets_in_project(self, auth_headers):
        if not hasattr(TestWorkspaces, "proj_id"):
            pytest.skip("No project_id")
        resp = requests.get(f"{BASE_URL}/api/projects/{TestWorkspaces.proj_id}/datasets", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_trigger_analysis(self, auth_headers):
        if not TestDatasets.ds_id:
            pytest.skip("No dataset_id")
        resp = requests.post(f"{BASE_URL}/api/datasets/{TestDatasets.ds_id}/analyze", headers=auth_headers)
        assert resp.status_code in (200, 201, 202)
        data = resp.json()
        assert "analysis_id" in data or "run_id" in data or "status" in data

    def test_cleanup_workspace(self, auth_headers):
        if TestWorkspaces.ws_id:
            resp = requests.delete(f"{BASE_URL}/api/workspaces/{TestWorkspaces.ws_id}", headers=auth_headers)
            assert resp.status_code == 200
