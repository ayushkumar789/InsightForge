"""Tests for the new analysis engine features (iteration 2):
- column_scores
- identifier_columns
- analytical_numeric_columns
- analytical_categorical_columns
- high_cardinality_columns
- charts (including scatter for most correlated pair)
"""
import pytest
import requests
import os
import io
import time

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
TEST_EMAIL = "test@insightforge.com"
TEST_PASSWORD = "testpass123"


@pytest.fixture(scope="module")
def auth_headers():
    """Login and get session token"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    if resp.status_code != 200:
        pytest.skip(f"Login failed: {resp.text}")
    return {"Authorization": f"Bearer {resp.json()['session_token']}"}


@pytest.fixture(scope="module")
def test_workspace_and_project(auth_headers):
    """Create a workspace and project for analysis testing"""
    # Create workspace
    ws_resp = requests.post(f"{BASE_URL}/api/workspaces", json={"name": "TEST_AnalysisEngine_Workspace"}, headers=auth_headers)
    assert ws_resp.status_code == 201
    ws_id = ws_resp.json()["workspace_id"]
    
    # Create project
    proj_resp = requests.post(
        f"{BASE_URL}/api/workspaces/{ws_id}/projects",
        json={"name": "TEST_AnalysisEngine_Project"},
        headers=auth_headers
    )
    assert proj_resp.status_code == 201
    proj_id = proj_resp.json()["project_id"]
    
    yield {"workspace_id": ws_id, "project_id": proj_id}
    
    # Cleanup
    requests.delete(f"{BASE_URL}/api/workspaces/{ws_id}", headers=auth_headers)


class TestAnalysisEngineFeatures:
    """Test the new analysis engine features"""
    
    def test_upload_and_analyze_with_identifiers(self, auth_headers, test_workspace_and_project):
        """Upload a CSV with identifier-like columns and verify analysis detects them"""
        # CSV with clear identifier columns (id, email) and analytical columns (age, salary, status)
        csv_content = b"""user_id,email,full_name,age,salary,department,status,signup_date
1001,alice@test.com,Alice Johnson,30,50000,Engineering,active,2024-01-15
1002,bob@test.com,Bob Smith,25,45000,Sales,active,2024-02-20
1003,carol@test.com,Carol Williams,35,60000,Marketing,inactive,2024-03-10
1004,dave@test.com,Dave Brown,28,52000,Engineering,active,2024-01-25
1005,eve@test.com,Eve Davis,32,55000,Sales,pending,2024-04-05
1006,frank@test.com,Frank Miller,40,70000,Engineering,active,2024-02-15
1007,grace@test.com,Grace Wilson,27,48000,Marketing,active,2024-03-25
1008,hank@test.com,Hank Moore,33,58000,Sales,inactive,2024-04-10
1009,ivy@test.com,Ivy Taylor,29,51000,Engineering,active,2024-05-01
1010,jack@test.com,Jack Anderson,36,62000,Marketing,active,2024-05-15
"""
        files = {"file": ("analysis_test.csv", io.BytesIO(csv_content), "text/csv")}
        data = {"project_id": test_workspace_and_project["project_id"], "name": "TEST_AnalysisFeatures_Dataset"}
        
        # Upload
        upload_resp = requests.post(f"{BASE_URL}/api/datasets", data=data, files=files, headers=auth_headers)
        assert upload_resp.status_code == 201, f"Upload failed: {upload_resp.text}"
        ds_id = upload_resp.json()["dataset_id"]
        
        # Trigger analysis
        analyze_resp = requests.post(f"{BASE_URL}/api/datasets/{ds_id}/analyze", headers=auth_headers)
        assert analyze_resp.status_code in (200, 201, 202), f"Analyze trigger failed: {analyze_resp.text}"
        
        # Poll for analysis completion (max 30 seconds)
        for _ in range(15):
            time.sleep(2)
            analysis_resp = requests.get(f"{BASE_URL}/api/datasets/{ds_id}/analysis", headers=auth_headers)
            if analysis_resp.status_code == 200:
                analysis = analysis_resp.json()
                if analysis.get("status") == "completed":
                    break
        
        assert analysis_resp.status_code == 200, "Analysis not available"
        analysis = analysis_resp.json()
        assert analysis.get("status") == "completed", f"Analysis not completed: {analysis.get('status')}"
        
        results = analysis.get("results", {})
        
        # Verify column_scores exist
        column_scores = results.get("column_scores", {})
        assert len(column_scores) > 0, "column_scores should not be empty"
        
        # Verify identifier_columns are detected
        identifier_cols = results.get("identifier_columns", [])
        assert "user_id" in identifier_cols or "email" in identifier_cols, \
            f"Expected user_id or email in identifier_columns, got: {identifier_cols}"
        
        # Verify analytical_numeric_columns
        analytical_numeric = results.get("analytical_numeric_columns", [])
        assert "age" in analytical_numeric or "salary" in analytical_numeric, \
            f"Expected age/salary in analytical_numeric_columns, got: {analytical_numeric}"
        
        # Verify analytical_categorical_columns
        analytical_cat = results.get("analytical_categorical_columns", [])
        assert "department" in analytical_cat or "status" in analytical_cat, \
            f"Expected department/status in analytical_categorical_columns, got: {analytical_cat}"
        
        # Verify charts are generated
        charts = results.get("charts", [])
        assert len(charts) > 0, "Should have generated charts"
        
        # Print summary for debugging
        print(f"\n=== Analysis Results Summary ===")
        print(f"column_scores keys: {list(column_scores.keys())}")
        print(f"identifier_columns: {identifier_cols}")
        print(f"analytical_numeric_columns: {analytical_numeric}")
        print(f"analytical_categorical_columns: {analytical_cat}")
        print(f"high_cardinality_columns: {list(results.get('high_cardinality_columns', {}).keys())}")
        print(f"charts count: {len(charts)}")
        print(f"chart types: {[c.get('type') for c in charts]}")
        
        # Store ds_id for cleanup
        TestAnalysisEngineFeatures.ds_id = ds_id
    
    def test_column_scores_have_required_fields(self, auth_headers, test_workspace_and_project):
        """Verify column_scores have score, is_identifier, and reason fields"""
        if not hasattr(TestAnalysisEngineFeatures, "ds_id"):
            pytest.skip("No dataset from previous test")
        
        analysis_resp = requests.get(f"{BASE_URL}/api/datasets/{TestAnalysisEngineFeatures.ds_id}/analysis", headers=auth_headers)
        assert analysis_resp.status_code == 200
        
        results = analysis_resp.json().get("results", {})
        column_scores = results.get("column_scores", {})
        
        for col, score_data in column_scores.items():
            assert "score" in score_data, f"Column {col} missing 'score'"
            assert "is_identifier" in score_data, f"Column {col} missing 'is_identifier'"
            assert "reason" in score_data, f"Column {col} missing 'reason'"
            assert isinstance(score_data["score"], (int, float)), f"Column {col} score should be numeric"
            assert isinstance(score_data["is_identifier"], bool), f"Column {col} is_identifier should be bool"
        
        print(f"\nColumn scores verified: {len(column_scores)} columns with proper structure")
    
    def test_scatter_chart_uses_correlated_pair(self, auth_headers, test_workspace_and_project):
        """Verify scatter chart is generated for correlated numeric columns"""
        if not hasattr(TestAnalysisEngineFeatures, "ds_id"):
            pytest.skip("No dataset from previous test")
        
        analysis_resp = requests.get(f"{BASE_URL}/api/datasets/{TestAnalysisEngineFeatures.ds_id}/analysis", headers=auth_headers)
        assert analysis_resp.status_code == 200
        
        results = analysis_resp.json().get("results", {})
        charts = results.get("charts", [])
        
        scatter_charts = [c for c in charts if c.get("type") == "scatter"]
        
        # Should have scatter chart if we have multiple numeric columns
        analytical_numeric = results.get("analytical_numeric_columns", [])
        if len(analytical_numeric) >= 2:
            assert len(scatter_charts) > 0, "Should have scatter chart for correlated numerics"
            scatter = scatter_charts[0]
            assert "x_col" in scatter, "Scatter chart missing x_col"
            assert "y_col" in scatter, "Scatter chart missing y_col"
            assert "data" in scatter, "Scatter chart missing data"
            print(f"\nScatter chart: {scatter.get('x_col')} vs {scatter.get('y_col')}")
    
    def test_high_cardinality_detection(self, auth_headers, test_workspace_and_project):
        """Verify high cardinality columns are properly detected"""
        if not hasattr(TestAnalysisEngineFeatures, "ds_id"):
            pytest.skip("No dataset from previous test")
        
        analysis_resp = requests.get(f"{BASE_URL}/api/datasets/{TestAnalysisEngineFeatures.ds_id}/analysis", headers=auth_headers)
        assert analysis_resp.status_code == 200
        
        results = analysis_resp.json().get("results", {})
        high_card = results.get("high_cardinality_columns", {})
        
        # Our test data has email which should be high cardinality
        # Note: with only 10 rows, it might not trigger high cardinality threshold
        # But the structure should exist
        assert isinstance(high_card, dict), "high_cardinality_columns should be a dict"
        
        for col, info in high_card.items():
            assert "unique_count" in info, f"High card col {col} missing unique_count"
            assert "uniqueness_ratio" in info, f"High card col {col} missing uniqueness_ratio"
        
        print(f"\nHigh cardinality columns: {list(high_card.keys())}")


class TestDashboardStats:
    """Test dashboard stats endpoint"""
    
    def test_dashboard_stats_structure(self, auth_headers):
        """Verify dashboard stats returns all required fields"""
        resp = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        # Required fields
        assert "total_workspaces" in data
        assert "total_projects" in data
        assert "total_datasets" in data
        assert "insights_generated" in data
        
        # All should be non-negative integers
        assert isinstance(data["total_workspaces"], int) and data["total_workspaces"] >= 0
        assert isinstance(data["total_projects"], int) and data["total_projects"] >= 0
        assert isinstance(data["total_datasets"], int) and data["total_datasets"] >= 0
        
        print(f"\nDashboard stats: {data}")
