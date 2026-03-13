import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import Layout from "../components/Layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/ui/dropdown-menu";
import { Skeleton } from "../components/ui/skeleton";
import {
  FolderOpen, Plus, MoreVertical, Pencil, Trash2, ArrowRight,
  Database, Loader2, ChevronRight, Layers
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function ProjectCard({ project, onEdit, onDelete, onClick }) {
  return (
    <div
      className="p-5 rounded-xl border border-border/50 bg-card hover:border-primary/30 transition-colors cursor-pointer group"
      onClick={onClick}
      data-testid={`project-card-${project.project_id}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="h-9 w-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
          <FolderOpen className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" data-testid={`project-menu-${project.project_id}`}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(project); }}>
              <Pencil className="h-4 w-4 mr-2" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(project); }}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <h3 className="font-semibold mb-1 truncate">{project.name}</h3>
      {project.description && <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{project.description}</p>}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Database className="h-3 w-3" /> {project.dataset_count || 0} datasets</span>
        <span>{formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}</span>
      </div>
    </div>
  );
}

export default function WorkspaceDetail() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [deleteProject, setDeleteProject] = useState(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      const [wsRes, projRes] = await Promise.all([
        axios.get(`${API}/workspaces/${workspaceId}`, { withCredentials: true }),
        axios.get(`${API}/workspaces/${workspaceId}/projects`, { withCredentials: true }),
      ]);
      setWorkspace(wsRes.data);
      setProjects(projRes.data);
    } catch { toast.error("Failed to load workspace"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [workspaceId]);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await axios.post(`${API}/workspaces/${workspaceId}/projects`, form, { withCredentials: true });
      toast.success("Project created");
      setCreateOpen(false);
      setForm({ name: "", description: "" });
      fetchData();
    } catch { toast.error("Failed to create project"); }
    finally { setSaving(false); }
  };

  const handleRename = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/projects/${editProject.project_id}`, form, { withCredentials: true });
      toast.success("Project updated");
      setEditProject(null);
      fetchData();
    } catch { toast.error("Failed to update"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await axios.delete(`${API}/projects/${deleteProject.project_id}`, { withCredentials: true });
      toast.success("Project deleted");
      setDeleteProject(null);
      fetchData();
    } catch { toast.error("Failed to delete"); }
    finally { setSaving(false); }
  };

  return (
    <Layout>
      <div className="p-6 max-w-5xl" data-testid="workspace-detail-page">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6">
          <button onClick={() => navigate("/workspaces")} className="hover:text-foreground flex items-center gap-1">
            <Layers className="h-3.5 w-3.5" /> Workspaces
          </button>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">{workspace?.name || "..."}</span>
        </div>

        <div className="flex items-center justify-between mb-8">
          {loading ? <Skeleton className="h-9 w-48" /> : (
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{workspace?.name}</h1>
              <p className="text-sm text-muted-foreground mt-1">{projects.length} project{projects.length !== 1 ? "s" : ""}</p>
            </div>
          )}
          <Button className="gradient-indigo text-white gap-2" onClick={() => { setForm({ name: "", description: "" }); setCreateOpen(true); }} data-testid="create-project-btn">
            <Plus className="h-4 w-4" /> New Project
          </Button>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-3 gap-4">
            {[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-xl" data-testid="empty-projects">
            <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">No projects yet</h3>
            <p className="text-sm text-muted-foreground mb-6">Create a project to start uploading datasets</p>
            <Button className="gradient-indigo text-white gap-2" onClick={() => { setForm({ name: "", description: "" }); setCreateOpen(true); }}>
              <Plus className="h-4 w-4" /> Create project
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {projects.map(p => (
              <ProjectCard
                key={p.project_id}
                project={p}
                onClick={() => navigate(`/workspaces/${workspaceId}/projects/${p.project_id}`)}
                onEdit={(p) => { setEditProject(p); setForm({ name: p.name, description: p.description || "" }); }}
                onDelete={setDeleteProject}
              />
            ))}
          </div>
        )}

        {/* Create dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>New Project</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Project name</Label>
                <Input className="mt-1" placeholder="e.g. Sales Q1 Analysis" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })} data-testid="project-name-input" />
              </div>
              <div><Label>Description (optional)</Label>
                <Textarea className="mt-1" placeholder="Brief description..." value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button className="gradient-indigo text-white" onClick={handleCreate} disabled={saving} data-testid="create-project-confirm-btn">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit dialog */}
        <Dialog open={!!editProject} onOpenChange={(o) => !o && setEditProject(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Project</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label>
                <Input className="mt-1" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div><Label>Description</Label>
                <Textarea className="mt-1" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditProject(null)}>Cancel</Button>
              <Button className="gradient-indigo text-white" onClick={handleRename} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete dialog */}
        <Dialog open={!!deleteProject} onOpenChange={(o) => !o && setDeleteProject(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Delete Project?</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              Permanently delete <strong>{deleteProject?.name}</strong> and all its datasets?
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteProject(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={saving} data-testid="delete-project-confirm-btn">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
