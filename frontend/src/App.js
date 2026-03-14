import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn, useAuth, useUser } from "@clerk/clerk-react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "./components/ui/sonner";
import AxiosInterceptor from "./components/AxiosInterceptor";
import UserSync from "./components/UserSync";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import WorkspacesPage from "./pages/WorkspacesPage";
import WorkspaceDetail from "./pages/WorkspaceDetail";
import ProjectDetail from "./pages/ProjectDetail";
import DatasetDetail from "./pages/DatasetDetail";
import AnalysisPage from "./pages/AnalysisPage";
import InsightsPage from "./pages/InsightsPage";
import ReportPage from "./pages/ReportPage";
import Settings from "./pages/Settings";

import "./index.css";

const CLERK_KEY = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;

function ProtectedRoute({ children }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!isSignedIn) {
    return <RedirectToSignIn />;
  }
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login/*" element={<Login />} />
      <Route path="/signup/*" element={<Signup />} />

      {/* Protected routes */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/workspaces" element={<ProtectedRoute><WorkspacesPage /></ProtectedRoute>} />
      <Route path="/workspaces/:workspaceId" element={<ProtectedRoute><WorkspaceDetail /></ProtectedRoute>} />
      <Route path="/workspaces/:workspaceId/projects/:projectId" element={<ProtectedRoute><ProjectDetail /></ProtectedRoute>} />
      <Route path="/datasets/:datasetId" element={<ProtectedRoute><DatasetDetail /></ProtectedRoute>} />
      <Route path="/datasets/:datasetId/analysis" element={<ProtectedRoute><AnalysisPage /></ProtectedRoute>} />
      <Route path="/datasets/:datasetId/insights" element={<ProtectedRoute><InsightsPage /></ProtectedRoute>} />
      <Route path="/datasets/:datasetId/report" element={<ProtectedRoute><ReportPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function ClerkNavigationProvider({ children }) {
  const navigate = useNavigate();
  return (
    <ClerkProvider
      publishableKey={CLERK_KEY}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      signInUrl="/login"
      signUpUrl="/signup"
      afterSignOutUrl="/"
    >
      {children}
    </ClerkProvider>
  );
}

export default function App() {
  if (!CLERK_KEY) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Configuration Required</h1>
          <p className="text-muted-foreground">Set REACT_APP_CLERK_PUBLISHABLE_KEY in frontend/.env</p>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <BrowserRouter>
        <ClerkNavigationProvider>
          <AxiosInterceptor>
            <UserSync>
              <AppRoutes />
            </UserSync>
          </AxiosInterceptor>
          <Toaster richColors position="top-right" />
        </ClerkNavigationProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
