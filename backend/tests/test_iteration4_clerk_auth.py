"""
InsightForge - Iteration 4 Backend Tests
Testing Clerk auth protection and CORS after runtime debugging fixes.

Tests verify:
1. Health endpoint is public
2. All protected endpoints return 401 without auth
3. CORS headers are correctly configured
"""

import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    pytest.skip("REACT_APP_BACKEND_URL not set", allow_module_level=True)

BASE_URL = BASE_URL.rstrip("/")


class TestHealthEndpoint:
    """Health check endpoint - PUBLIC"""

    def test_health_check_returns_ok(self):
        """GET /api/ should return status: ok"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
        assert "service" in data


class TestAuthEndpointsNoAuth:
    """Auth endpoints should return 401 without authentication"""

    def test_auth_me_without_auth_returns_401(self):
        """GET /api/auth/me without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        assert "Not authenticated" in response.text or "detail" in response.json()

    def test_auth_sync_without_auth_returns_401(self):
        """POST /api/auth/sync without auth returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/sync",
            json={"email": "test@test.com", "name": "Test"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 401
        assert "Not authenticated" in response.text or "detail" in response.json()

    def test_auth_profile_without_auth_returns_401(self):
        """PUT /api/auth/profile without auth returns 401"""
        response = requests.put(
            f"{BASE_URL}/api/auth/profile",
            json={"name": "Test"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 401


class TestWorkspacesNoAuth:
    """Workspace endpoints should return 401 without authentication"""

    def test_get_workspaces_without_auth_returns_401(self):
        """GET /api/workspaces without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/workspaces")
        assert response.status_code == 401

    def test_create_workspace_without_auth_returns_401(self):
        """POST /api/workspaces without auth returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/workspaces",
            json={"name": "Test Workspace", "description": "Test"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 401

    def test_get_workspace_by_id_without_auth_returns_401(self):
        """GET /api/workspaces/{id} without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/workspaces/ws_test123")
        assert response.status_code == 401

    def test_update_workspace_without_auth_returns_401(self):
        """PUT /api/workspaces/{id} without auth returns 401"""
        response = requests.put(
            f"{BASE_URL}/api/workspaces/ws_test123",
            json={"name": "Updated"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 401

    def test_delete_workspace_without_auth_returns_401(self):
        """DELETE /api/workspaces/{id} without auth returns 401"""
        response = requests.delete(f"{BASE_URL}/api/workspaces/ws_test123")
        assert response.status_code == 401


class TestDashboardNoAuth:
    """Dashboard endpoints should return 401 without authentication"""

    def test_dashboard_stats_without_auth_returns_401(self):
        """GET /api/dashboard/stats without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 401


class TestProjectsNoAuth:
    """Project endpoints should return 401 without authentication"""

    def test_get_projects_without_auth_returns_401(self):
        """GET /api/workspaces/{id}/projects without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/workspaces/ws_test123/projects")
        assert response.status_code == 401

    def test_create_project_without_auth_returns_401(self):
        """POST /api/workspaces/{id}/projects without auth returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/workspaces/ws_test123/projects",
            json={"name": "Test Project"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 401


class TestDatasetsNoAuth:
    """Dataset endpoints should return 401 without authentication"""

    def test_get_datasets_without_auth_returns_401(self):
        """GET /api/projects/{id}/datasets without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/projects/proj_test123/datasets")
        assert response.status_code == 401

    def test_get_dataset_without_auth_returns_401(self):
        """GET /api/datasets/{id} without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/datasets/ds_test123")
        assert response.status_code == 401


class TestAnalysisNoAuth:
    """Analysis endpoints should return 401 without authentication"""

    def test_trigger_analysis_without_auth_returns_401(self):
        """POST /api/datasets/{id}/analyze without auth returns 401"""
        response = requests.post(f"{BASE_URL}/api/datasets/ds_test123/analyze")
        assert response.status_code == 401

    def test_get_analysis_without_auth_returns_401(self):
        """GET /api/datasets/{id}/analysis without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/datasets/ds_test123/analysis")
        assert response.status_code == 401


class TestInsightsNoAuth:
    """Insights endpoints should return 401 without authentication"""

    def test_trigger_insights_without_auth_returns_401(self):
        """POST /api/datasets/{id}/insights without auth returns 401"""
        response = requests.post(f"{BASE_URL}/api/datasets/ds_test123/insights")
        assert response.status_code == 401

    def test_get_insights_without_auth_returns_401(self):
        """GET /api/datasets/{id}/insights without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/datasets/ds_test123/insights")
        assert response.status_code == 401


class TestReportsNoAuth:
    """Report endpoints should return 401 without authentication"""

    def test_generate_report_without_auth_returns_401(self):
        """POST /api/datasets/{id}/report without auth returns 401"""
        response = requests.post(f"{BASE_URL}/api/datasets/ds_test123/report")
        assert response.status_code == 401

    def test_get_report_without_auth_returns_401(self):
        """GET /api/datasets/{id}/report without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/datasets/ds_test123/report")
        assert response.status_code == 401


class TestCORSConfiguration:
    """Test CORS is properly configured"""

    def test_cors_preflight_returns_headers(self):
        """OPTIONS preflight with Origin should return CORS headers"""
        response = requests.options(
            f"{BASE_URL}/api/workspaces",
            headers={
                "Origin": "https://forge-responsive.preview.emergentagent.com",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type, Authorization"
            }
        )
        # Preflight returns 200 or 204
        assert response.status_code in [200, 204]
        # Check CORS headers present
        assert "access-control-allow-origin" in response.headers
        assert "access-control-allow-methods" in response.headers

    def test_cors_origin_header_on_get(self):
        """GET request with Origin should include Access-Control-Allow-Origin in response"""
        response = requests.get(
            f"{BASE_URL}/api/",
            headers={"Origin": "https://forge-responsive.preview.emergentagent.com"}
        )
        assert response.status_code == 200
        # CORS headers should be present
        assert "access-control-allow-origin" in response.headers


class TestInvalidTokenHandling:
    """Test that invalid tokens are properly rejected"""

    def test_invalid_bearer_token_returns_401(self):
        """Request with invalid Bearer token should return 401"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": "Bearer invalid_token_here"}
        )
        assert response.status_code == 401

    def test_malformed_auth_header_returns_401(self):
        """Request with malformed Authorization header should return 401"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": "NotBearer token"}
        )
        assert response.status_code == 401

    def test_empty_bearer_token_returns_401(self):
        """Request with empty Bearer token should return 401"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": "Bearer "}
        )
        assert response.status_code == 401
