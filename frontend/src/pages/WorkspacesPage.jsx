import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import Layout from "../components/Layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/ui/dropdown-menu";
import { Skeleton } from "../components/ui/skeleton";
import { Layers, Plus, FolderOpen, MoreVertical, Pencil, Trash2, ArrowRight, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function WorkspaceCard({ ws, onEdit, onDelete, onClick }) {
  return (
    <div
      className="p-5 rounded-xl border border-border/50 bg-card hover:border-primary/30 transition-colors cursor-pointer group"
      onClick={onClick}
      data-testid={`workspace-card-${ws.workspace_id}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="h-10 w-10 rounded-lg gradient-indigo flex items-center justify-center">
          <Layers className="h-5 w-5 text-white" />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" data-testid={`workspace-menu-${ws.workspace_id}`}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(ws); }} data-testid="rename-workspace-item">
              <Pencil className="h-4 w-4 mr-2" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(ws); }}
              data-testid="delete-workspace-item"
            >
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <h3 className="font-semibold mb-1 truncate">{ws.name}</h3>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{ws.project_count || 0} project{ws.project_count !== 1 ? "s" : ""}</span>
        <span>{formatDistanceToNow(new Date(ws.created_at), { addSuffix: true })}</span>
      </div>
      <div className="mt-3 flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
        Open workspace <ArrowRight className="h-3 w-3" />
      </div>
    </div>
  );
}

export default function WorkspacesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editWs, setEditWs] = useState(null);
  const [deleteWs, setDeleteWs] = useState(null);
  const [wsName, setWsName] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchWorkspaces = () =>
    axios.get(`${API}/workspaces`, { withCredentials: true })
      .then(r => setWorkspaces(r.data))
      .catch(() => toast.error("Failed to load workspaces"))
      .finally(() => setLoading(false));

  useEffect(() => { fetchWorkspaces(); }, []);

  const handleCreate = async () => {
    if (!wsName.trim()) return;
    setSaving(true);
    try {
      await axios.post(`${API}/workspaces`, { name: wsName.trim() }, { withCredentials: true });
      toast.success("Workspace created");
      setCreateOpen(false);
      setWsName("");
      fetchWorkspaces();
    } catch { toast.error("Failed to create workspace"); }
    finally { setSaving(false); }
  };

  const handleRename = async () => {
    if (!wsName.trim()) return;
    setSaving(true);
    try {
      await axios.put(`${API}/workspaces/${editWs.workspace_id}`, { name: wsName.trim() }, { withCredentials: true });
      toast.success("Workspace renamed");
      setEditWs(null);
      setWsName("");
      fetchWorkspaces();
    } catch { toast.error("Failed to rename"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await axios.delete(`${API}/workspaces/${deleteWs.workspace_id}`, { withCredentials: true });
      toast.success("Workspace deleted");
      setDeleteWs(null);
      fetchWorkspaces();
    } catch { toast.error("Failed to delete"); }
    finally { setSaving(false); }
  };

  return (
    <Layout>
      <div className="p-6 max-w-5xl" data-testid="workspaces-page">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Workspaces</h1>
            <p className="text-sm text-muted-foreground mt-1">Organize your analytics projects</p>
          </div>
          <Button className="gradient-indigo text-white gap-2" onClick={() => { setWsName(""); setCreateOpen(true); }} data-testid="create-workspace-btn">
            <Plus className="h-4 w-4" /> New Workspace
          </Button>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-3 gap-4">
            {[1,2,3].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}
          </div>
        ) : workspaces.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-xl" data-testid="empty-workspaces">
            <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">No workspaces yet</h3>
            <p className="text-sm text-muted-foreground mb-6">Create your first workspace to get started</p>
            <Button className="gradient-indigo text-white gap-2" onClick={() => { setWsName(""); setCreateOpen(true); }} data-testid="create-first-workspace-btn">
              <Plus className="h-4 w-4" /> Create workspace
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {workspaces.map(ws => (
              <WorkspaceCard
                key={ws.workspace_id}
                ws={ws}
                onClick={() => navigate(`/workspaces/${ws.workspace_id}`)}
                onEdit={(ws) => { setEditWs(ws); setWsName(ws.name); }}
                onDelete={setDeleteWs}
              />
            ))}
          </div>
        )}

        {/* Create dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>New Workspace</DialogTitle></DialogHeader>
            <Input placeholder="Workspace name" value={wsName} onChange={e => setWsName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreate()} data-testid="workspace-name-input" />
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button className="gradient-indigo text-white" onClick={handleCreate} disabled={saving} data-testid="create-workspace-confirm-btn">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit dialog */}
        <Dialog open={!!editWs} onOpenChange={(o) => !o && setEditWs(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Rename Workspace</DialogTitle></DialogHeader>
            <Input value={wsName} onChange={e => setWsName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleRename()} data-testid="rename-workspace-input" />
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditWs(null)}>Cancel</Button>
              <Button className="gradient-indigo text-white" onClick={handleRename} disabled={saving} data-testid="rename-workspace-confirm-btn">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete dialog */}
        <Dialog open={!!deleteWs} onOpenChange={(o) => !o && setDeleteWs(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Delete Workspace?</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              This will permanently delete <strong>{deleteWs?.name}</strong> and all its projects and datasets.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteWs(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={saving} data-testid="delete-workspace-confirm-btn">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
