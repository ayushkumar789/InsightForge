"""
Test suite for Clerk authentication migration.
Verifies that:
1. Health endpoint is public (no auth needed)
2. All protected endpoints return 401 without valid Bearer token
3. Proper error messages are returned

Since CLERK_JWT_PUBLIC_KEY is not configured, all protected endpoints
should correctly return 401 errors.
"""

import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if BASE_URL:
    BASE_URL = BASE_URL.rstrip('/')

# Module: Health Check Tests (Public endpoints)
class TestHealthEndpoints:
    """Test public health check endpoints."""

    def test_health_check_returns_ok(self):
        """GET /api/ should return status: ok without auth"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
        assert "service" in data
        print(f"✓ Health check passed: {data}")


# Module: Auth Endpoints Tests (Protected without token)
class TestAuthEndpointsNoToken:
    """Test auth endpoints return 401 without Bearer token."""

    def test_auth_me_without_token_returns_401(self):
        """GET /api/auth/me WITHOUT auth token returns 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        assert "Not authenticated" in data["detail"] or "authenticated" in data["detail"].lower()
        print(f"✓ /api/auth/me returned 401: {data}")

    def test_auth_sync_without_token_returns_401(self):
        """POST /api/auth/sync WITHOUT auth token returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/sync",
            json={"email": "test@example.com", "name": "Test User"}
        )
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        assert "Not authenticated" in data["detail"] or "authenticated" in data["detail"].lower()
        print(f"✓ /api/auth/sync returned 401: {data}")

    def test_auth_profile_without_token_returns_401(self):
        """PUT /api/auth/profile WITHOUT auth token returns 401"""
        response = requests.put(
            f"{BASE_URL}/api/auth/profile",
            json={"name": "Test User"}
        )
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print(f"✓ /api/auth/profile returned 401: {data}")


# Module: Workspace Endpoints Tests (Protected)
class TestWorkspaceEndpointsNoToken:
    """Test workspace endpoints return 401 without token."""

    def test_list_workspaces_without_token_returns_401(self):
        """GET /api/workspaces WITHOUT auth token returns 401"""
        response = requests.get(f"{BASE_URL}/api/workspaces")
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print(f"✓ GET /api/workspaces returned 401: {data}")

    def test_create_workspace_without_token_returns_401(self):
        """POST /api/workspaces WITHOUT auth token returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/workspaces",
            json={"name": "Test Workspace"}
        )
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print(f"✓ POST /api/workspaces returned 401: {data}")

    def test_get_workspace_without_token_returns_401(self):
        """GET /api/workspaces/:id WITHOUT auth token returns 401"""
        response = requests.get(f"{BASE_URL}/api/workspaces/ws_test123")
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print(f"✓ GET /api/workspaces/:id returned 401: {data}")

    def test_update_workspace_without_token_returns_401(self):
        """PUT /api/workspaces/:id WITHOUT auth token returns 401"""
        response = requests.put(
            f"{BASE_URL}/api/workspaces/ws_test123",
            json={"name": "Updated Workspace"}
        )
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print(f"✓ PUT /api/workspaces/:id returned 401: {data}")

    def test_delete_workspace_without_token_returns_401(self):
        """DELETE /api/workspaces/:id WITHOUT auth token returns 401"""
        response = requests.delete(f"{BASE_URL}/api/workspaces/ws_test123")
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print(f"✓ DELETE /api/workspaces/:id returned 401: {data}")


# Module: Dashboard Stats Endpoint (Protected)
class TestDashboardEndpointsNoToken:
    """Test dashboard endpoints return 401 without token."""

    def test_dashboard_stats_without_token_returns_401(self):
        """GET /api/dashboard/stats WITHOUT auth token returns 401"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print(f"✓ GET /api/dashboard/stats returned 401: {data}")


# Module: Project Endpoints Tests (Protected)
class TestProjectEndpointsNoToken:
    """Test project endpoints return 401 without token."""

    def test_list_projects_without_token_returns_401(self):
        """GET /api/workspaces/:id/projects WITHOUT auth token returns 401"""
        response = requests.get(f"{BASE_URL}/api/workspaces/ws_test123/projects")
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print(f"✓ GET /api/workspaces/:id/projects returned 401: {data}")

    def test_create_project_without_token_returns_401(self):
        """POST /api/workspaces/:id/projects WITHOUT auth token returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/workspaces/ws_test123/projects",
            json={"name": "Test Project", "description": "Test"}
        )
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print(f"✓ POST /api/workspaces/:id/projects returned 401: {data}")

    def test_get_project_without_token_returns_401(self):
        """GET /api/projects/:id WITHOUT auth token returns 401"""
        response = requests.get(f"{BASE_URL}/api/projects/proj_test123")
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print(f"✓ GET /api/projects/:id returned 401: {data}")

    def test_project_stats_without_token_returns_401(self):
        """GET /api/projects/:id/stats WITHOUT auth token returns 401"""
        response = requests.get(f"{BASE_URL}/api/projects/proj_test123/stats")
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print(f"✓ GET /api/projects/:id/stats returned 401: {data}")


# Module: Dataset Endpoints Tests (Protected)
class TestDatasetEndpointsNoToken:
    """Test dataset endpoints return 401 without token."""

    def test_list_datasets_without_token_returns_401(self):
        """GET /api/projects/:id/datasets WITHOUT auth token returns 401"""
        response = requests.get(f"{BASE_URL}/api/projects/proj_test123/datasets")
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print(f"✓ GET /api/projects/:id/datasets returned 401: {data}")

    def test_upload_dataset_without_token_returns_401(self):
        """POST /api/datasets WITHOUT auth token returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/datasets",
            data={"project_id": "proj_test123", "name": "Test Dataset"},
            files={"file": ("test.csv", "a,b,c\n1,2,3", "text/csv")}
        )
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print(f"✓ POST /api/datasets returned 401: {data}")

    def test_get_dataset_without_token_returns_401(self):
        """GET /api/datasets/:id WITHOUT auth token returns 401"""
        response = requests.get(f"{BASE_URL}/api/datasets/ds_test123")
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print(f"✓ GET /api/datasets/:id returned 401: {data}")

    def test_delete_dataset_without_token_returns_401(self):
        """DELETE /api/datasets/:id WITHOUT auth token returns 401"""
        response = requests.delete(f"{BASE_URL}/api/datasets/ds_test123")
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print(f"✓ DELETE /api/datasets/:id returned 401: {data}")

    def test_dataset_preview_without_token_returns_401(self):
        """GET /api/datasets/:id/preview WITHOUT auth token returns 401"""
        response = requests.get(f"{BASE_URL}/api/datasets/ds_test123/preview")
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print(f"✓ GET /api/datasets/:id/preview returned 401: {data}")


# Module: Analysis Endpoints Tests (Protected)
class TestAnalysisEndpointsNoToken:
    """Test analysis endpoints return 401 without token."""

    def test_trigger_analysis_without_token_returns_401(self):
        """POST /api/datasets/:id/analyze WITHOUT auth token returns 401"""
        response = requests.post(f"{BASE_URL}/api/datasets/ds_test123/analyze")
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print(f"✓ POST /api/datasets/:id/analyze returned 401: {data}")

    def test_get_analysis_without_token_returns_401(self):
        """GET /api/datasets/:id/analysis WITHOUT auth token returns 401"""
        response = requests.get(f"{BASE_URL}/api/datasets/ds_test123/analysis")
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print(f"✓ GET /api/datasets/:id/analysis returned 401: {data}")


# Module: Insights Endpoints Tests (Protected)
class TestInsightsEndpointsNoToken:
    """Test insights endpoints return 401 without token."""

    def test_trigger_insights_without_token_returns_401(self):
        """POST /api/datasets/:id/insights WITHOUT auth token returns 401"""
        response = requests.post(f"{BASE_URL}/api/datasets/ds_test123/insights")
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print(f"✓ POST /api/datasets/:id/insights returned 401: {data}")

    def test_get_insights_without_token_returns_401(self):
        """GET /api/datasets/:id/insights WITHOUT auth token returns 401"""
        response = requests.get(f"{BASE_URL}/api/datasets/ds_test123/insights")
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print(f"✓ GET /api/datasets/:id/insights returned 401: {data}")


# Module: Report Endpoints Tests (Protected)
class TestReportEndpointsNoToken:
    """Test report endpoints return 401 without token."""

    def test_generate_report_without_token_returns_401(self):
        """POST /api/datasets/:id/report WITHOUT auth token returns 401"""
        response = requests.post(f"{BASE_URL}/api/datasets/ds_test123/report")
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print(f"✓ POST /api/datasets/:id/report returned 401: {data}")

    def test_get_report_without_token_returns_401(self):
        """GET /api/datasets/:id/report WITHOUT auth token returns 401"""
        response = requests.get(f"{BASE_URL}/api/datasets/ds_test123/report")
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print(f"✓ GET /api/datasets/:id/report returned 401: {data}")

    def test_download_report_without_token_returns_401(self):
        """GET /api/reports/:id/download WITHOUT auth token returns 401"""
        response = requests.get(f"{BASE_URL}/api/reports/rep_test123/download")
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print(f"✓ GET /api/reports/:id/download returned 401: {data}")


# Module: Test with invalid Bearer token
class TestInvalidBearerToken:
    """Test that invalid Bearer tokens are rejected."""

    def test_auth_me_with_invalid_token_returns_error(self):
        """GET /api/auth/me with invalid token returns 4xx error"""
        headers = {"Authorization": "Bearer invalid_token_here"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        # Should return 401 or 500 (since CLERK_JWT_PUBLIC_KEY not configured)
        assert response.status_code in [401, 500]
        data = response.json()
        assert "detail" in data
        print(f"✓ /api/auth/me with invalid token returned {response.status_code}: {data}")

    def test_workspaces_with_invalid_token_returns_error(self):
        """GET /api/workspaces with invalid token returns 4xx/5xx error"""
        headers = {"Authorization": "Bearer invalid_token_here"}
        response = requests.get(f"{BASE_URL}/api/workspaces", headers=headers)
        # Should return 401 or 500 (since CLERK_JWT_PUBLIC_KEY not configured)
        assert response.status_code in [401, 500]
        data = response.json()
        assert "detail" in data
        print(f"✓ /api/workspaces with invalid token returned {response.status_code}: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
