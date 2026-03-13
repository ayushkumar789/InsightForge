import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import Layout from "../components/Layout";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import {
  Database, ChevronRight, FolderOpen, Layers, BarChart2,
  ArrowLeft, FileText, Hash, Calendar, HardDrive
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TYPE_COLORS = {
  int64: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  float64: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  object: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  bool: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  datetime64: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

function TypeBadge({ dtype }) {
  const key = Object.keys(TYPE_COLORS).find(k => dtype?.includes(k)) || "object";
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${TYPE_COLORS[key]}`}>{dtype || "—"}</span>
  );
}

export default function DatasetDetail() {
  const { datasetId } = useParams();
  const navigate = useNavigate();
  const [dataset, setDataset] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSheet, setSelectedSheet] = useState(null);

  const fetchPreview = async (sheet = null) => {
    try {
      const params = sheet ? `?sheet=${encodeURIComponent(sheet)}` : "";
      const res = await axios.get(`${API}/datasets/${datasetId}/preview${params}`, { withCredentials: true });
      setPreview(res.data);
    } catch (err) {
      toast.error("Failed to load preview");
    }
  };

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/datasets/${datasetId}`, { withCredentials: true }),
    ]).then(([dsRes]) => {
      setDataset(dsRes.data);
    }).catch(() => toast.error("Dataset not found"))
      .finally(() => setLoading(false));

    fetchPreview();
  }, [datasetId]);

  const handleSheetChange = (sheet) => {
    setSelectedSheet(sheet);
    fetchPreview(sheet);
  };

  if (loading) return (
    <Layout>
      <div className="p-6"><Skeleton className="h-8 w-48 mb-4" /><Skeleton className="h-64 w-full" /></div>
    </Layout>
  );

  return (
    <Layout>
      <div className="p-6 w-full max-w-[1800px] mx-auto" data-testid="dataset-detail-page">
        {/* Back + breadcrumb */}
        <Button variant="ghost" size="sm" className="gap-1 mb-4 text-muted-foreground" onClick={() => navigate(-1)} data-testid="back-btn">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{dataset?.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">{dataset?.original_filename}</p>
          </div>
          <div className="flex gap-2">
            {(dataset?.status === "analysis_complete" || dataset?.status === "insights_generated") && (
              <Button size="sm" className="gradient-indigo text-white gap-1" onClick={() => navigate(`/datasets/${datasetId}/analysis`)} data-testid="view-analysis-btn">
                <BarChart2 className="h-4 w-4" /> View Analysis
              </Button>
            )}
          </div>
        </div>

        {/* Meta cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 2xl:grid-cols-6 gap-3 mb-6">
          {[
            { icon: FileText, label: "Type", value: dataset?.file_type?.toUpperCase() },
            { icon: HardDrive, label: "Size", value: dataset?.file_size ? `${(dataset.file_size / 1024).toFixed(1)} KB` : "—" },
            { icon: Hash, label: "Rows", value: preview?.row_count?.toLocaleString() || "—" },
            { icon: Calendar, label: "Uploaded", value: dataset?.created_at ? formatDistanceToNow(new Date(dataset.created_at), { addSuffix: true }) : "—" },
          ].map(m => (
            <div key={m.label} className="p-3 rounded-lg bg-card border border-border/50">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <m.icon className="h-3.5 w-3.5" />
                <span className="text-xs">{m.label}</span>
              </div>
              <p className="text-sm font-semibold">{m.value}</p>
            </div>
          ))}
        </div>

        {/* Excel sheet selector */}
        {preview?.sheets && preview.sheets.length > 1 && (
          <div className="flex items-center gap-2 mb-4">
            <label className="text-sm text-muted-foreground">Sheet:</label>
            <Select value={selectedSheet || preview.sheets[0]} onValueChange={handleSheetChange}>
              <SelectTrigger className="w-40 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {preview.sheets.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {preview?.parse_error ? (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive" data-testid="parse-error">
            Failed to parse file: {preview.parse_error}
          </div>
        ) : (
          <>
            {/* Column info */}
            <div className="mb-6">
              <h2 className="text-base font-semibold mb-3">Columns ({preview?.columns?.length || 0})</h2>
              <div className="flex flex-wrap gap-2">
                {preview?.columns?.map(col => (
                  <div key={col} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-card border border-border/50">
                    <span className="text-sm font-medium">{col}</span>
                    {preview?.dtypes?.[col] && <TypeBadge dtype={preview.dtypes[col]} />}
                  </div>
                ))}
              </div>
            </div>

            {/* Preview table */}
            {preview?.preview_rows?.length > 0 && (
              <div>
                <h2 className="text-base font-semibold mb-3">Data Preview (first {preview.preview_rows.length} rows)</h2>
                <div className="overflow-x-auto rounded-lg border border-border" data-testid="preview-table">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50">
                        {preview.columns.map(col => (
                          <th key={col} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap border-b border-border">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.preview_rows.map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                          {preview.columns.map(col => (
                            <td key={col} className="px-3 py-2 border-b border-border/50 whitespace-nowrap max-w-[200px] truncate font-mono">
                              {row[col] ?? ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
