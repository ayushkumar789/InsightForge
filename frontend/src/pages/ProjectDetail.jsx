import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import Layout from "../components/Layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Skeleton } from "../components/ui/skeleton";
import { Progress } from "../components/ui/progress";
import {
  Upload, Database, MoreVertical, Eye, BarChart2, Lightbulb, FileText,
  RefreshCw, Trash2, Play, Loader2, Plus, ChevronRight, FolderOpen, Layers,
  AlertCircle, CheckCircle2, Clock, XCircle
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "../components/ui/dropdown-menu";
import { formatDistanceToNow, format } from "date-fns";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_CONFIG = {
  uploaded: { label: "Uploaded", color: "badge-uploaded", icon: Clock },
  processing: { label: "Processing", color: "badge-processing", icon: Loader2 },
  analysis_complete: { label: "Analysis Complete", color: "badge-analysis_complete", icon: CheckCircle2 },
  insights_generated: { label: "Insights Generated", color: "badge-insights_generated", icon: Lightbulb },
  failed: { label: "Failed", color: "badge-failed", icon: XCircle },
  outdated: { label: "Outdated", color: "badge-outdated", icon: AlertCircle },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: "badge-outdated", icon: Clock };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}
      data-testid={`status-badge-${status}`}>
      <Icon className={`h-3 w-3 ${status === "processing" ? "animate-spin" : ""}`} />
      {cfg.label}
    </span>
  );
}

function formatBytes(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function DatasetCard({ dataset, onRefresh, projectId, workspaceId }) {
  const navigate = useNavigate();
  const [analyzing, setAnalyzing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const replaceRef = useRef();

  const runAnalysis = async (e) => {
    e.stopPropagation();
    setAnalyzing(true);
    try {
      await axios.post(`${API}/datasets/${dataset.dataset_id}/analyze`, {}, { withCredentials: true });
      toast.success("Analysis started — this may take a moment");
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to start analysis");
    } finally { setAnalyzing(false); }
  };

  const handleReplace = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      await axios.put(`${API}/datasets/${dataset.dataset_id}/replace`, fd, {
        withCredentials: true, headers: { "Content-Type": "multipart/form-data" }
      });
      toast.success("Dataset replaced — previous analysis invalidated");
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Replace failed");
    } finally {
      setUploading(false);
      if (replaceRef.current) replaceRef.current.value = "";
    }
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete dataset "${dataset.name}"?`)) return;
    try {
      await axios.delete(`${API}/datasets/${dataset.dataset_id}`, { withCredentials: true });
      toast.success("Dataset deleted");
      onRefresh();
    } catch { toast.error("Delete failed"); }
  };

  const status = dataset.status;

  return (
    <div className="rounded-xl border border-border/50 bg-card hover:border-primary/20 transition-colors group" data-testid={`dataset-card-${dataset.dataset_id}`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Database className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm truncate">{dataset.name}</h3>
              <p className="text-xs text-muted-foreground truncate">{dataset.original_filename}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <StatusBadge status={status} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`dataset-menu-${dataset.dataset_id}`}>
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/datasets/${dataset.dataset_id}`)}>
                  <Eye className="h-4 w-4 mr-2" /> Preview
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => replaceRef.current?.click()} disabled={uploading}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Replace file
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground mb-4">
          <div><span className="block text-foreground font-medium">{dataset.file_type?.toUpperCase() || "—"}</span>Type</div>
          <div><span className="block text-foreground font-medium">{formatBytes(dataset.file_size)}</span>Size</div>
          <div><span className="block text-foreground font-medium">{dataset.row_count?.toLocaleString() || "—"}</span>Rows</div>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Uploaded {formatDistanceToNow(new Date(dataset.created_at), { addSuffix: true })}
          {dataset.version > 1 && <span className="ml-2 text-amber-500">v{dataset.version}</span>}
        </p>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {(status === "uploaded" || status === "outdated" || status === "failed") && (
            <Button size="sm" className="gradient-indigo text-white gap-1 h-7 text-xs" onClick={runAnalysis} disabled={analyzing} data-testid={`run-analysis-btn-${dataset.dataset_id}`}>
              {analyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
              {status === "failed" ? "Retry" : "Run Analysis"}
            </Button>
          )}
          {status === "processing" && (
            <Button size="sm" variant="outline" disabled className="h-7 text-xs gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Processing...
            </Button>
          )}
          {(status === "analysis_complete" || status === "insights_generated") && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => navigate(`/datasets/${dataset.dataset_id}/analysis`)} data-testid={`view-analysis-btn-${dataset.dataset_id}`}>
              <BarChart2 className="h-3 w-3" /> View Analysis
            </Button>
          )}
          {status === "analysis_complete" && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-purple-300 text-purple-600 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-900/20" onClick={() => navigate(`/datasets/${dataset.dataset_id}/insights`)} data-testid={`get-insights-btn-${dataset.dataset_id}`}>
              <Lightbulb className="h-3 w-3" /> Get Insights
            </Button>
          )}
          {status === "insights_generated" && (
            <>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-purple-300 text-purple-600 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-900/20" onClick={() => navigate(`/datasets/${dataset.dataset_id}/insights`)} data-testid={`view-insights-btn-${dataset.dataset_id}`}>
                <Lightbulb className="h-3 w-3" /> View Insights
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => navigate(`/datasets/${dataset.dataset_id}/report`)} data-testid={`report-btn-${dataset.dataset_id}`}>
                <FileText className="h-3 w-3" /> Report
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => navigate(`/datasets/${dataset.dataset_id}`)} data-testid={`preview-btn-${dataset.dataset_id}`}>
            <Eye className="h-3 w-3" /> Preview
          </Button>
        </div>
      </div>

      {/* Hidden file input for replace */}
      <input ref={replaceRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleReplace} data-testid={`replace-file-input-${dataset.dataset_id}`} />
    </div>
  );
}

function UploadZone({ projectId, onUploaded }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dsName, setDsName] = useState("");
  const [file, setFile] = useState(null);
  const fileRef = useRef();
  const [open, setOpen] = useState(false);

  const startUpload = async () => {
    if (!file || !dsName.trim()) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("project_id", projectId);
    fd.append("name", dsName.trim());
    fd.append("file", file);
    try {
      await axios.post(`${API}/datasets`, fd, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => setProgress(Math.round(e.loaded / e.total * 100)),
      });
      toast.success("Dataset uploaded successfully");
      setOpen(false);
      setFile(null);
      setDsName("");
      onUploaded();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Upload failed");
    } finally { setUploading(false); setProgress(0); }
  };

  return (
    <>
      <button
        className={`w-full p-5 rounded-xl border-2 border-dashed transition-colors text-center ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
        onClick={() => setOpen(true)}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) { setFile(f); setDsName(f.name.replace(/\.[^.]+$/, "")); setOpen(true); }
        }}
        data-testid="upload-dataset-btn"
      >
        <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm font-medium">Upload Dataset</p>
        <p className="text-xs text-muted-foreground mt-1">CSV or XLSX · Click or drag & drop</p>
      </button>

      <Dialog open={open} onOpenChange={(o) => { if (!uploading) setOpen(o); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload Dataset</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Dataset name</Label>
              <Input className="mt-1" placeholder="e.g. Sales Data Q1 2024" value={dsName}
                onChange={e => setDsName(e.target.value)} data-testid="dataset-name-input" />
            </div>
            <div>
              <Label>File (CSV or XLSX)</Label>
              <div className="mt-1 flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} data-testid="choose-file-btn">
                  Choose file
                </Button>
                {file && <span className="text-sm text-muted-foreground truncate">{file.name}</span>}
              </div>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); if (!dsName) setDsName(f.name.replace(/\.[^.]+$/, "")); } }} />
            </div>
            {uploading && <Progress value={progress} className="h-1.5" />}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={uploading}>Cancel</Button>
            <Button className="gradient-indigo text-white" onClick={startUpload} disabled={!file || !dsName || uploading} data-testid="upload-confirm-btn">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              {uploading ? `Uploading ${progress}%...` : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function ProjectDetail() {
  const { workspaceId, projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const [projRes, dsRes, statsRes] = await Promise.all([
        axios.get(`${API}/projects/${projectId}`, { withCredentials: true }),
        axios.get(`${API}/projects/${projectId}/datasets`, { withCredentials: true }),
        axios.get(`${API}/projects/${projectId}/stats`, { withCredentials: true }),
      ]);
      setProject(projRes.data);
      setDatasets(dsRes.data);
      setStats(statsRes.data);
    } catch { toast.error("Failed to load project"); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => {
    fetchData();
    // Poll if any dataset is processing
    pollRef.current = setInterval(() => {
      if (datasets.some(d => d.status === "processing")) {
        fetchData();
      }
    }, 3000);
    return () => clearInterval(pollRef.current);
  }, [fetchData]);

  useEffect(() => {
    if (datasets.some(d => d.status === "processing")) {
      pollRef.current = setInterval(fetchData, 3000);
    } else {
      clearInterval(pollRef.current);
    }
    return () => clearInterval(pollRef.current);
  }, [datasets, fetchData]);

  return (
    <Layout>
      <div className="p-6 max-w-6xl" data-testid="project-detail-page">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6">
          <button onClick={() => navigate("/workspaces")} className="hover:text-foreground flex items-center gap-1">
            <Layers className="h-3.5 w-3.5" /> Workspaces
          </button>
          <ChevronRight className="h-3.5 w-3.5" />
          <button onClick={() => navigate(`/workspaces/${workspaceId}`)} className="hover:text-foreground flex items-center gap-1">
            <FolderOpen className="h-3.5 w-3.5" /> {project?.workspace_id ? "Workspace" : "..."}
          </button>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">{project?.name || "..."}</span>
        </div>

        {/* Header */}
        <div className="mb-6">
          {loading ? <Skeleton className="h-9 w-56 mb-2" /> : (
            <>
              <h1 className="text-3xl font-bold tracking-tight">{project?.name}</h1>
              {project?.description && <p className="text-sm text-muted-foreground mt-1">{project.description}</p>}
            </>
          )}
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
            {[
              { label: "Total", val: stats.total_datasets, color: "text-foreground" },
              { label: "Uploaded", val: stats.uploaded, color: "text-blue-500" },
              { label: "Processing", val: stats.processing, color: "text-amber-500" },
              { label: "Complete", val: stats.analysis_complete, color: "text-green-500" },
              { label: "Insights", val: stats.insights_generated, color: "text-purple-500" },
              { label: "Failed", val: stats.failed, color: "text-red-500" },
            ].map(s => (
              <div key={s.label} className="p-3 rounded-lg bg-card border border-border/50 text-center">
                <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Datasets grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <Skeleton key={i} className="h-52 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <UploadZone projectId={projectId} onUploaded={fetchData} />
            {datasets.map(ds => (
              <DatasetCard key={ds.dataset_id} dataset={ds} onRefresh={fetchData} projectId={projectId} workspaceId={workspaceId} />
            ))}
          </div>
        )}

        {!loading && datasets.length === 0 && (
          <p className="text-center text-sm text-muted-foreground mt-8">Upload your first dataset using the button above.</p>
        )}
      </div>
    </Layout>
  );
}
