import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import Layout from "../components/Layout";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { ArrowLeft, FileText, Download, Loader2, AlertCircle, CheckCircle2, Clock } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

function StatusIcon({ status }) {
  if (status === "completed") return <CheckCircle2 className="h-5 w-5 text-green-500" />;
  if (status === "failed") return <AlertCircle className="h-5 w-5 text-red-500" />;
  if (status === "generating" || status === "pending") return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
  return <Clock className="h-5 w-5 text-muted-foreground" />;
}

export default function ReportPage() {
  const { datasetId } = useParams();
  const navigate = useNavigate();
  const [dataset, setDataset] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const pollRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const dsRes = await axios.get(`${API}/datasets/${datasetId}`, { withCredentials: true });
      setDataset(dsRes.data);
      try {
        const repRes = await axios.get(`${API}/datasets/${datasetId}/report`, { withCredentials: true });
        setReport(repRes.data);
      } catch {}
    } catch { toast.error("Dataset not found"); }
    finally { setLoading(false); }
  }, [datasetId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const running = report?.status === "pending" || report?.status === "generating";
    if (running) {
      pollRef.current = setInterval(fetchData, 3000);
    } else {
      clearInterval(pollRef.current);
    }
    return () => clearInterval(pollRef.current);
  }, [report?.status, fetchData]);

  const generateReport = async () => {
    setGenerating(true);
    try {
      await axios.post(`${API}/datasets/${datasetId}/report`, {}, { withCredentials: true });
      toast.success("Report generation started");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to generate report");
    } finally { setGenerating(false); }
  };

  const downloadReport = () => {
    if (!report?.report_id) return;
    const url = `${BACKEND_URL}/api/reports/${report.report_id}/download`;
    window.open(url, "_blank");
  };

  const canGenerate = dataset?.status === "analysis_complete" || dataset?.status === "insights_generated";
  const isRunning = report?.status === "pending" || report?.status === "generating";
  const isCompleted = report?.status === "completed";
  const isFailed = report?.status === "failed";

  return (
    <Layout>
      <div className="p-6 max-w-3xl" data-testid="report-page">
        <Button variant="ghost" size="sm" className="gap-1 mb-4 text-muted-foreground" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Report Export
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{dataset?.name}</p>
          </div>
          <div className="flex gap-2">
            {canGenerate && !isRunning && (
              <Button className="gradient-indigo text-white gap-2" onClick={generateReport} disabled={generating} data-testid="generate-report-btn">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                {isCompleted ? "Regenerate" : "Generate Report"}
              </Button>
            )}
            {isCompleted && (
              <Button variant="outline" className="gap-2" onClick={downloadReport} data-testid="download-report-btn">
                <Download className="h-4 w-4" /> Download PDF
              </Button>
            )}
          </div>
        </div>

        {/* Requirement check */}
        {!canGenerate && !loading && (
          <div className="text-center py-16 border border-dashed border-border rounded-xl" data-testid="analysis-required">
            <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
            <p className="font-medium mb-1">Analysis required first</p>
            <p className="text-sm text-muted-foreground mb-4">Complete analysis before generating a report</p>
            <Button onClick={() => navigate(`/datasets/${datasetId}/analysis`)}>Go to Analysis</Button>
          </div>
        )}

        {/* Status card */}
        {report && (
          <div className="p-6 rounded-xl bg-card border border-border/50 mb-6" data-testid="report-status-card">
            <div className="flex items-center gap-3 mb-4">
              <StatusIcon status={report.status} />
              <div>
                <p className="font-semibold capitalize">{report.status === "completed" ? "Report ready" : report.status}</p>
                <p className="text-xs text-muted-foreground">
                  {report.completed_at ? `Completed ${new Date(report.completed_at).toLocaleString()}` : `Started ${new Date(report.created_at).toLocaleString()}`}
                </p>
              </div>
            </div>
            {isFailed && (
              <p className="text-sm text-destructive">{report.error_message}</p>
            )}
            {isCompleted && (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="text-green-600 dark:text-green-400 font-medium">Your PDF report is ready for download.</p>
                <p>The report includes: dataset overview, analysis statistics, visualizations, and {report.insight_id ? "AI insights." : "no AI insights (generate insights first for a richer report)."}</p>
              </div>
            )}
          </div>
        )}

        {/* What's included */}
        <div className="p-5 rounded-xl bg-card border border-border/50">
          <h3 className="font-semibold mb-3">Report Contents</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {[
              "Dataset overview and metadata",
              "Data quality score and summary",
              "Missing values analysis",
              "Numeric column statistics (min, max, mean, std, etc.)",
              "Chart visualizations (histograms, bar charts, scatter plots, heatmap)",
              dataset?.status === "insights_generated" ? "AI-powered business insights" : "(AI insights — not yet generated)",
              "Professional PDF format with InsightForge branding",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle2 className={`h-4 w-4 mt-0.5 flex-shrink-0 ${item.startsWith("(") ? "text-muted-foreground/40" : "text-green-500"}`} />
                <span className={item.startsWith("(") ? "opacity-50" : ""}>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Layout>
  );
}
