import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthCallback from "./components/AuthCallback";

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

function AppRouter() {
  const hash = window.location.hash;
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS
  if (hash?.includes("session_id=")) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

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

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <AuthProvider>
        <BrowserRouter>
          <AppRouter />
          <Toaster richColors position="top-right" />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
