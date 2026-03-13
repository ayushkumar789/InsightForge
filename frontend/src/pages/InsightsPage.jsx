import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import Layout from "../components/Layout";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { ArrowLeft, Lightbulb, Loader2, AlertCircle, RefreshCw, CheckCircle2, TrendingUp, AlertTriangle, FileText, Target } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function InsightSection({ icon: Icon, title, items, color = "text-primary" }) {
  if (!items?.length) return null;
  return (
    <div className="p-5 rounded-xl bg-card border border-border/50" data-testid={`insight-section-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`h-4 w-4 ${color}`} />
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
            <span className={`mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${color.replace('text-', 'bg-')}`} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function InsightsPage() {
  const { datasetId } = useParams();
  const navigate = useNavigate();
  const [dataset, setDataset] = useState(null);
  const [insight, setInsight] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const pollRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const dsRes = await axios.get(`${API}/datasets/${datasetId}`, { withCredentials: true });
      setDataset(dsRes.data);
      try {
        const anaRes = await axios.get(`${API}/datasets/${datasetId}/analysis`, { withCredentials: true });
        setAnalysis(anaRes.data);
      } catch {}
      try {
        const insRes = await axios.get(`${API}/datasets/${datasetId}/insights`, { withCredentials: true });
        setInsight(insRes.data);
      } catch {}
    } catch { toast.error("Dataset not found"); }
    finally { setLoading(false); }
  }, [datasetId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const running = insight?.status === "pending" || insight?.status === "running";
    if (running) {
      pollRef.current = setInterval(fetchData, 3000);
    } else {
      clearInterval(pollRef.current);
    }
    return () => clearInterval(pollRef.current);
  }, [insight?.status, fetchData]);

  const triggerInsights = async () => {
    setGenerating(true);
    try {
      await axios.post(`${API}/datasets/${datasetId}/insights`, {}, { withCredentials: true });
      toast.success("Insight generation started");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to generate insights");
    } finally { setGenerating(false); }
  };

  const ins = insight?.insights || {};
  const isCompleted = insight?.status === "completed";
  const isRunning = insight?.status === "pending" || insight?.status === "running";
  const isFailed = insight?.status === "failed";
  const canGenerate = dataset?.status === "analysis_complete" || dataset?.status === "insights_generated";

  return (
    <Layout>
      <div className="p-6 w-full max-w-screen-2xl mx-auto" data-testid="insights-page">
        <Button variant="ghost" size="sm" className="gap-1 mb-4 text-muted-foreground" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Lightbulb className="h-6 w-6 text-purple-500" />
              AI Insights
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{dataset?.name} · Powered by {insight?.model_used || "Gemini"}</p>
          </div>
          <div className="flex gap-2">
            {canGenerate && !isRunning && (
              <Button
                className="gradient-indigo text-white gap-2"
                onClick={triggerInsights}
                disabled={generating}
                data-testid="generate-insights-btn"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4" />}
                {isCompleted ? "Regenerate" : "Generate Insights"}
              </Button>
            )}
            {isCompleted && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/datasets/${datasetId}/report`)} data-testid="generate-report-btn">
                <FileText className="h-4 w-4 mr-2" /> Generate Report
              </Button>
            )}
          </div>
        </div>

        {/* Not ready state */}
        {!canGenerate && !loading && (
          <div className="text-center py-16 border border-dashed border-border rounded-xl" data-testid="analysis-required">
            <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
            <p className="font-medium mb-1">Analysis required first</p>
            <p className="text-sm text-muted-foreground mb-4">Run deterministic analysis before generating AI insights</p>
            <Button onClick={() => navigate(`/datasets/${datasetId}/analysis`)}>Go to Analysis</Button>
          </div>
        )}

        {/* Running state */}
        {isRunning && (
          <div className="text-center py-16 border border-border rounded-xl" data-testid="insights-running">
            <Loader2 className="h-10 w-10 animate-spin mx-auto mb-3 text-purple-500" />
            <p className="font-medium">Generating AI insights...</p>
            <p className="text-sm text-muted-foreground mt-1">Analyzing your data with Gemini</p>
          </div>
        )}

        {/* Failed */}
        {isFailed && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2 text-sm text-destructive mb-6" data-testid="insights-failed">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Insight generation failed</p>
              <p className="mt-0.5">{insight?.error_message}</p>
              <p className="mt-1 text-muted-foreground">Make sure GEMINI_API_KEY is set in the backend .env file.</p>
            </div>
          </div>
        )}

        {/* Empty — can generate */}
        {canGenerate && !insight && !loading && !generating && (
          <div className="text-center py-16 border border-dashed border-border rounded-xl" data-testid="no-insights">
            <Lightbulb className="h-10 w-10 text-purple-400 mx-auto mb-3" />
            <p className="font-medium mb-1">No insights yet</p>
            <p className="text-sm text-muted-foreground mb-4">Generate AI-powered insights from your analysis results</p>
            <Button className="gradient-indigo text-white gap-2" onClick={triggerInsights} disabled={generating} data-testid="generate-insights-empty-btn">
              <Lightbulb className="h-4 w-4" /> Generate Insights
            </Button>
          </div>
        )}

        {/* Results */}
        {isCompleted && (
          <div className="space-y-4" data-testid="insights-results">
            {/* Executive summary */}
            {ins.executive_summary && (
              <div className="p-5 rounded-xl bg-gradient-to-br from-primary/5 to-transparent border border-primary/20">
                <h3 className="font-semibold text-sm mb-2 text-primary">Executive Summary</h3>
                <p className="text-sm leading-relaxed">{ins.executive_summary}</p>
              </div>
            )}

            {/* Plain language */}
            {ins.plain_language_summary && ins.plain_language_summary !== ins.executive_summary && (
              <div className="p-5 rounded-xl bg-card border border-border/50">
                <h3 className="font-semibold text-sm mb-2 text-muted-foreground">For Business Stakeholders</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{ins.plain_language_summary}</p>
              </div>
            )}

            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              <InsightSection icon={TrendingUp} title="Key Trends" items={ins.key_trends} color="text-blue-500" />
              <InsightSection icon={AlertTriangle} title="Anomalies & Patterns" items={ins.anomalies} color="text-amber-500" />
              <InsightSection icon={CheckCircle2} title="Business Insights" items={ins.business_insights} color="text-green-500" />
              <InsightSection icon={Target} title="Recommendations" items={ins.recommendations} color="text-purple-500" />
              <InsightSection icon={AlertCircle} title="Data Quality Notes" items={ins.data_quality_notes} color="text-red-500" />
            </div>

            <p className="text-xs text-muted-foreground text-right mt-4">
              Generated by {insight.model_used} · {insight.completed_at ? new Date(insight.completed_at).toLocaleString() : ""}
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
