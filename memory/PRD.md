# InsightForge PRD

## Product Overview
InsightForge is a full-stack SaaS dataset analytics workspace platform.

**User Flow:** Clerk Sign-in → Dashboard → Workspace → Project → Dataset → Analysis → Insights → Report Export

## Architecture
- **Frontend:** React 18 + Tailwind CSS + Shadcn UI + Recharts + @clerk/clerk-react
- **Backend:** FastAPI + MongoDB + Motor (async) + PyJWT (Clerk JWT verification)
- **Auth:** Clerk (email/password, Google, GitHub) — JWT Bearer tokens
- **AI:** Google Gemini 2.5 Flash via emergentintegrations (user-provided API key)
- **PDF:** ReportLab + matplotlib
- **File Storage:** `/app/uploads/datasets/` and `/app/uploads/reports/`

## Auth Architecture (Clerk)
- **Frontend:** `ClerkProvider` wraps the app. `AxiosInterceptor` attaches `Authorization: Bearer <clerk-token>` to all axios requests. `UserSync` creates/updates local DB user on first sign-in.
- **Backend:** `get_current_user` FastAPI dependency verifies Clerk JWT (RS256) from Authorization header. Auto-creates user record in MongoDB on first authenticated request.
- **Routes:** `/login` renders Clerk `<SignIn>`, `/signup` renders Clerk `<SignUp>`. Protected routes use `ProtectedRoute` component with Clerk `useAuth()`.

## Core Requirements (Static)
1. Authentication via Clerk (email/password, Google, GitHub)
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
- User (clerk_user_id, email, name, picture, auth_provider)
- Workspace (members array for future collaboration)
- Project
- Dataset (separate from AnalysisRun)
- AnalysisRun (deterministic results)
- InsightRun (AI output, separate from analysis)
- Report (PDF metadata)

## What's Been Implemented

### Phase 1 - Core Platform ✅
- Workspace CRUD with cascade delete
- Project CRUD with cascade delete
- Dataset upload (CSV/XLSX), preview, replace, delete
- Dataset status badges (6 states)
- Contextual action buttons per dataset status

### Phase 2 - Analysis Engine ✅
- Deterministic analysis engine (pandas, numpy)
- Stats: row/col count, missing values, duplicates, numeric/categorical summaries, correlations, outliers, quality score
- Chart data generation: histograms, scatter, bar, grouped bar, heatmap
- Column relevance scoring, identifier detection, smart chart recommendations
- Analysis persistence in MongoDB (AnalysisRun)
- Recharts visualization: BarChart, ScatterChart, custom correlation heatmap

### Phase 3 - AI Insights ✅
- Gemini insights generation (requires GEMINI_API_KEY)
- Structured prompt with analysis summary
- InsightRun persistence with model metadata
- Insights page with sections: Executive Summary, Trends, Anomalies, Insights, Recommendations

### Phase 4 - Reports ✅
- PDF report generation with ReportLab + matplotlib
- Report includes: dataset overview, statistics tables, chart images, AI insights
- Download endpoint with FileResponse

### Phase 5 - Analysis Refinement + Responsive Layout ✅ (2026-03-13)
- Column relevance scoring (0-100), identifier detection
- Smart scatter plot (most-correlated pair), Freedman-Diaconis binning
- Wider page containers (1536-1800px), 2xl grid breakpoints

### Phase 6 - Clerk Auth Migration ✅ (2026-03-14)
- **Full migration from custom JWT + Emergent OAuth to Clerk authentication**
- Frontend: @clerk/clerk-react with ClerkProvider, SignIn, SignUp, UserButton
- AxiosInterceptor: Global Bearer token injection for all API calls
- UserSync: Syncs Clerk user to local MongoDB on first sign-in
- Backend: PyJWT RS256 Clerk JWT verification, auto-create users
- Endpoints: /auth/sync (user creation), /auth/me, /auth/profile
- **Removed:** AuthContext, AuthCallback, ProtectedRoute (old), withCredentials, session cookies, password hashing, Emergent OAuth exchange, JWT_SECRET
- **Removed models:** UserCreate, UserLogin, GoogleSessionExchange, PasswordChange

### Phase 7 - Runtime Debugging & Auth Fixes (2026-03-14)
- **CORS fix:** Added preview domain to CORS_ORIGINS; set `allow_credentials=False` (Bearer tokens don't need credentials mode)
- **CLERK_ALLOWED_PARTIES fix:** Added preview domain; changed azp check to non-blocking (log warning only)
- **PEM key parsing fix:** Strip indentation whitespace from multi-line .env values so PyJWT can parse the RSA public key
- **AxiosInterceptor fix:** Replaced stale-closure pattern with `useRef`-based approach — interceptor registered once, always reads latest `getToken`/`isSignedIn` from refs
- **Debug endpoint removed:** Cleaned up temporary `/auth/debug-token` endpoint
- **Emergent removal:** Replaced `emergentintegrations` with direct `google-generativeai` SDK for Gemini insights
- **Verified end-to-end:** Sign-in → Dashboard → Workspaces → Projects → Datasets → Analysis → all working in preview

## Environment Variables Required
```
# Frontend (/app/frontend/.env)
REACT_APP_BACKEND_URL=<preview-url>
REACT_APP_CLERK_PUBLISHABLE_KEY=<clerk-publishable-key>  # Required

# Backend (/app/backend/.env)
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
CLERK_JWT_PUBLIC_KEY=<pem-public-key>  # Required (RS256)
CLERK_ALLOWED_PARTIES=<comma-separated-origins>  # Optional
GEMINI_API_KEY=<gemini-api-key>  # Required for AI insights
GEMINI_MODEL=gemini-2.5-flash
UPLOAD_DIR=/app/uploads
```

## Prioritized Backlog
### P0 (Required for App to Function)
- REACT_APP_CLERK_PUBLISHABLE_KEY must be set in frontend/.env
- CLERK_JWT_PUBLIC_KEY must be set in backend/.env
- GEMINI_API_KEY must be set in backend/.env for AI insights

### P1 (High Value)
- Workspace collaboration (invite members, editor/viewer roles)
- Activity log / audit trail
- Export individual charts as PNG

### P2 (Enhancement)
- Excel multi-sheet analysis
- Dataset versioning history UI
- Scheduled analysis runs
- API rate limiting
