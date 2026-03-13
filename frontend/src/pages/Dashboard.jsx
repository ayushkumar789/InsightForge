import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import Layout from "../components/Layout";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import {
  Layers, FolderOpen, Database, BarChart2, Lightbulb,
  ArrowRight, Plus, Clock
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function StatCard({ icon: Icon, label, value, color = "text-primary" }) {
  return (
    <div className="p-5 rounded-xl border border-border/50 bg-card" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className={`h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3 ${color.replace('text-', 'bg-').replace('primary', 'primary/10')}`}>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className="text-2xl font-bold">{value ?? <Skeleton className="h-7 w-12" />}</div>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/dashboard/stats`, { withCredentials: true })
      .then(r => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const statusLabels = {
    uploaded: "Uploaded", processing: "Processing",
    analysis_complete: "Analysis Complete", insights_generated: "Insights Generated",
    failed: "Failed", outdated: "Outdated",
  };

  const statusColors = {
    uploaded: "text-blue-500", analysis_complete: "text-green-500",
    insights_generated: "text-purple-500", failed: "text-red-500",
    processing: "text-amber-500",
  };

  return (
    <Layout>
      <div className="p-6 w-full max-w-screen-2xl mx-auto" data-testid="dashboard-page">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back, {user?.name?.split(" ")[0]}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Here's what's happening in your workspace.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Layers} label="Workspaces" value={loading ? null : stats?.total_workspaces ?? 0} />
          <StatCard icon={FolderOpen} label="Projects" value={loading ? null : stats?.total_projects ?? 0} />
          <StatCard icon={Database} label="Datasets" value={loading ? null : stats?.total_datasets ?? 0} />
          <StatCard icon={Lightbulb} label="Insights Generated" value={loading ? null : stats?.insights_generated ?? 0} color="text-purple-500" />
        </div>

        {/* Quick actions */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <div className="p-5 rounded-xl border border-border/50 bg-card">
            <h2 className="font-semibold mb-3">Quick Actions</h2>
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => navigate("/workspaces")}
                data-testid="goto-workspaces-btn"
              >
                <Layers className="h-4 w-4 text-primary" />
                View all workspaces
                <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => navigate("/workspaces")}
                data-testid="create-workspace-btn"
              >
                <Plus className="h-4 w-4 text-primary" />
                Create new workspace
                <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
              </Button>
            </div>
          </div>

          {/* Recent datasets */}
          <div className="p-5 rounded-xl border border-border/50 bg-card">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" /> Recent Datasets
            </h2>
            {loading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-9 w-full" />)}</div>
            ) : stats?.recent_datasets?.length > 0 ? (
              <div className="space-y-1">
                {stats.recent_datasets.map(ds => (
                  <button
                    key={ds.dataset_id}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-muted text-left text-sm"
                    onClick={() => navigate(`/datasets/${ds.dataset_id}`)}
                    data-testid={`recent-dataset-${ds.dataset_id}`}
                  >
                    <Database className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="truncate flex-1">{ds.name}</span>
                    <span className={`text-xs ${statusColors[ds.status] || 'text-muted-foreground'}`}>
                      {statusLabels[ds.status] || ds.status}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No datasets yet.</p>
            )}
          </div>
        </div>

        {/* Empty state */}
        {!loading && stats?.total_workspaces === 0 && (
          <div className="text-center py-12 border border-dashed border-border rounded-xl" data-testid="empty-dashboard">
            <Layers className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold mb-1">Get started with InsightForge</h3>
            <p className="text-sm text-muted-foreground mb-4">Create a workspace to organize your analytics projects</p>
            <Button className="gradient-indigo text-white" onClick={() => navigate("/workspaces")} data-testid="create-first-workspace-btn">
              <Plus className="h-4 w-4 mr-2" /> Create workspace
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
