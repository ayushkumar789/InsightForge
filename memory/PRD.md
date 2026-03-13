# InsightForge PRD

## Product Overview
InsightForge is a full-stack SaaS-style dataset analytics workspace platform.

**User Flow:** User Account → Workspace → Project → Dataset → Analysis → Insights → Report Export

## Architecture
- **Frontend:** React 18 + Tailwind CSS + Shadcn UI + Recharts
- **Backend:** FastAPI + MongoDB + Motor (async)
- **Auth:** JWT/email-password sessions + Google OAuth (Emergent Auth)
- **AI:** Google Gemini 2.5 Flash via emergentintegrations (user-provided API key)
- **PDF:** ReportLab + matplotlib
- **File Storage:** `/app/uploads/datasets/` and `/app/uploads/reports/`

## Core Requirements (Static)
1. Authentication (signup, login, Google OAuth, logout)
2. Workspace CRUD (create, rename, delete, list)
3. Project CRUD (create, rename, delete, list inside workspace)
4. Dataset upload (CSV/XLSX), status lifecycle, replace, delete, preview
5. Deterministic Python analysis (pandas/numpy/scipy)
6. Analysis persistence — save results in MongoDB
7. Chart visualization (histogram, bar, scatter, heatmap via Recharts)
8. AI insights via Gemini (separate InsightRun entity)
9. PDF report generation (ReportLab + matplotlib charts)
10. Dataset status system: uploaded → processing → analysis_complete → insights_generated / failed / outdated
11. Dark/light theme toggle (next-themes)
12. Project dashboard with dataset health stats

## Data Entities
- User, UserSession
- Workspace (members array for future collaboration)
- Project
- Dataset (separate from AnalysisRun)
- AnalysisRun (deterministic results)
- InsightRun (AI output, separate from analysis)
- Report (PDF metadata)

## Backend Files
- `server.py` — main app + CORS + startup
- `database.py` — MongoDB connection + indexes
- `models.py` — all Pydantic models
- `auth.py` — session auth middleware
- `analysis_engine.py` — deterministic analysis pipeline
- `insights_engine.py` — Gemini integration
- `report_generator.py` — ReportLab PDF generation
- `routers/auth_router.py` — /api/auth/*
- `routers/workspace_router.py` — /api/workspaces, /api/projects, /api/dashboard
- `routers/dataset_router.py` — /api/datasets, /api/projects/*/datasets
- `routers/analysis_router.py` — /api/datasets/*/analyze
- `routers/insights_router.py` — /api/datasets/*/insights
- `routers/report_router.py` — /api/datasets/*/report, /api/reports/*/download

## Frontend Pages
- Landing, Login, Signup (public)
- Dashboard, WorkspacesPage, WorkspaceDetail, ProjectDetail (workspace mgmt)
- DatasetDetail (preview), AnalysisPage (charts + stats), InsightsPage (AI), ReportPage (PDF)
- Settings (profile + password)

## What's Been Implemented (2024-03-13)
### Phase 1 ✅
- JWT + Google OAuth authentication (httponly cookie sessions)
- Workspace CRUD with cascade delete
- Project CRUD with cascade delete
- Dataset upload (CSV/XLSX), preview, replace, delete
- Dataset status badges (6 states)
- Contextual action buttons per dataset status

### Phase 2 ✅
- Deterministic analysis engine (pandas, numpy)
- Stats: row/col count, missing values, duplicates, numeric/categorical summaries, correlations, outliers, quality score
- Chart data generation: histograms, scatter, bar, grouped bar, heatmap
- Analysis persistence in MongoDB (AnalysisRun)
- Recharts visualization: BarChart, ScatterChart, custom correlation heatmap
- Background job execution (FastAPI BackgroundTasks + run_in_executor)

### Phase 3 ✅
- Gemini insights generation (requires GEMINI_API_KEY)
- Structured prompt with analysis summary (no raw data sent)
- InsightRun persistence with model metadata
- Insights page with sections: Executive Summary, Trends, Anomalies, Insights, Recommendations

### Phase 4 ✅
- PDF report generation with ReportLab + matplotlib
- Report includes: dataset overview, statistics tables, chart images, AI insights
- Download endpoint with FileResponse
- Dataset replacement with analysis invalidation

### Infrastructure ✅
- Dark/light theme toggle
- Collapsible sidebar
- Google Fonts (Plus Jakarta Sans, Inter, JetBrains Mono)
- Responsive card-based UI
- Status polling for processing datasets
- Error states, empty states, loading states

## Prioritized Backlog
### P0 (Critical — Needs User Action)
- **GEMINI_API_KEY must be added to /app/backend/.env** for AI insights to work

### P1 (High Value — Next Phase)
- Collaboration: invite team members to workspaces (editor/viewer roles)
- Email notifications when analysis completes
- Activity log/audit trail
- Export charts individually as PNG
- Workspace-level analytics overview

### P2 (Enhancement)
- Excel multi-sheet analysis support
- Dataset versioning history UI
- Scheduled analysis runs
- API rate limiting and usage tracking
- Custom analysis parameters (e.g., specific date column for time series)

## Environment Variables Required
```
# /app/backend/.env
GEMINI_API_KEY=<your-gemini-api-key>          # Required for AI insights
GEMINI_MODEL=gemini-2.5-flash                   # Default model (can change to gemini-2.5-pro)
```

## Test Credentials
- Email: test@insightforge.com
- Password: testpass123
