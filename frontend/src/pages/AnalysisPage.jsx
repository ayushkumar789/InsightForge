import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import Layout from "../components/Layout";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  BarChart, Bar, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts";
import {
  ArrowLeft, Play, BarChart2, Loader2, AlertCircle, CheckCircle2,
  TrendingUp, Hash, Percent, Layers, RefreshCw
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CHART_COLORS = ["#6366f1", "#06b6d4", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

function QualityScore({ score }) {
  const color = score >= 80 ? "text-green-500" : score >= 60 ? "text-amber-500" : "text-red-500";
  return (
    <div className="p-4 rounded-xl bg-card border border-border/50 text-center">
      <p className={`text-3xl font-bold ${color}`}>{score}%</p>
      <p className="text-xs text-muted-foreground mt-1">Data Quality Score</p>
    </div>
  );
}

function StatCard({ label, value, sub, color = "" }) {
  return (
    <div className="p-4 rounded-xl bg-card border border-border/50">
      <p className={`text-xl font-bold ${color}`}>{value ?? "—"}</p>
      <p className="text-xs font-medium">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function HeatmapChart({ chart }) {
  const { labels = [], matrix = [] } = chart;
  const getColor = (val) => {
    if (val === null || val === undefined) return "#e2e8f0";
    const abs = Math.abs(val);
    if (val > 0.7) return "#22c55e";
    if (val > 0.3) return "#86efac";
    if (val < -0.7) return "#ef4444";
    if (val < -0.3) return "#fca5a5";
    return "#e2e8f0";
  };
  const cellSize = Math.max(32, Math.min(60, Math.floor(400 / labels.length)));
  return (
    <div className="overflow-x-auto">
      <div className="inline-block">
        <div style={{ display: "grid", gridTemplateColumns: `auto repeat(${labels.length}, ${cellSize}px)` }} className="text-xs">
          <div />
          {labels.map(l => (
            <div key={l} className="text-center font-medium text-muted-foreground pb-1 truncate px-0.5" style={{ width: cellSize }}>{l}</div>
          ))}
          {matrix.map((row, i) => (
            <React.Fragment key={i}>
              <div className="text-right pr-2 py-0.5 text-muted-foreground font-medium truncate" style={{ maxWidth: 80 }}>{labels[i]}</div>
              {row.map((val, j) => (
                <div key={j} title={`${labels[i]} × ${labels[j]}: ${val}`}
                  style={{ background: getColor(val), width: cellSize, height: cellSize }}
                  className="flex items-center justify-center text-xs font-mono rounded-sm m-0.5 cursor-default">
                  {val !== null ? val?.toFixed(2) : ""}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChartCard({ chart }) {
  const type = chart.type;
  return (
    <div className="p-4 rounded-xl bg-card border border-border/50" data-testid={`chart-${chart.chart_id}`}>
      <h3 className="text-sm font-semibold mb-4">{chart.title}</h3>
      {type === "histogram" && (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chart.data} margin={{ left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="range" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="count" fill="#6366f1" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
      {(type === "bar" || type === "bar_grouped") && (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chart.data} margin={{ left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="category" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey={type === "bar" ? "count" : "value"} fill={type === "bar" ? "#6366f1" : "#06b6d4"} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
      {type === "scatter" && (
        <ResponsiveContainer width="100%" height={200}>
          <ScatterChart margin={{ left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="x" name={chart.x_col} tick={{ fontSize: 10 }} type="number" />
            <YAxis dataKey="y" name={chart.y_col} tick={{ fontSize: 10 }} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
            <Scatter data={chart.data} fill="#6366f1" opacity={0.7} />
          </ScatterChart>
        </ResponsiveContainer>
      )}
      {type === "heatmap" && <HeatmapChart chart={chart} />}
    </div>
  );
}

export default function AnalysisPage() {
  const { datasetId } = useParams();
  const navigate = useNavigate();
  const [dataset, setDataset] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const pollRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const dsRes = await axios.get(`${API}/datasets/${datasetId}`, { withCredentials: true });
      setDataset(dsRes.data);
      try {
        const anaRes = await axios.get(`${API}/datasets/${datasetId}/analysis`, { withCredentials: true });
        setAnalysis(anaRes.data);
      } catch {}
    } catch { toast.error("Dataset not found"); }
    finally { setLoading(false); }
  }, [datasetId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const isRunning = analysis?.status === "pending" || analysis?.status === "running"
      || dataset?.status === "processing";
    if (isRunning) {
      pollRef.current = setInterval(fetchData, 3000);
    } else {
      clearInterval(pollRef.current);
    }
    return () => clearInterval(pollRef.current);
  }, [analysis?.status, dataset?.status, fetchData]);

  const triggerAnalysis = async () => {
    setTriggering(true);
    try {
      await axios.post(`${API}/datasets/${datasetId}/analyze`, {}, { withCredentials: true });
      toast.success("Analysis started");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to start analysis");
    } finally { setTriggering(false); }
  };

  const r = analysis?.results || {};
  const charts = r.charts || [];
  const numericSummaries = r.numeric_summaries || {};
  const catSummaries = r.categorical_summaries || {};
  const isCompleted = analysis?.status === "completed";
  const isRunning = analysis?.status === "pending" || analysis?.status === "running" || dataset?.status === "processing";
  const isFailed = analysis?.status === "failed";

  return (
    <Layout>
      <div className="p-6 max-w-6xl" data-testid="analysis-page">
        <Button variant="ghost" size="sm" className="gap-1 mb-4 text-muted-foreground" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{dataset?.name || "Analysis"}</h1>
            <p className="text-sm text-muted-foreground mt-1">Deterministic Analysis Results</p>
          </div>
          <div className="flex gap-2">
            {!isCompleted && !isRunning && (
              <Button className="gradient-indigo text-white gap-2" onClick={triggerAnalysis} disabled={triggering} data-testid="trigger-analysis-btn">
                {triggering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Run Analysis
              </Button>
            )}
            {isRunning && (
              <Button variant="outline" disabled className="gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Analyzing...
              </Button>
            )}
            {isCompleted && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/datasets/${datasetId}/insights`)} className="border-purple-300 text-purple-600 dark:border-purple-700 dark:text-purple-400 gap-1" data-testid="get-insights-btn">
                Get AI Insights
              </Button>
            )}
          </div>
        </div>

        {/* Loading/Failed/Empty states */}
        {loading && <div className="grid grid-cols-4 gap-4 mb-6">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>}

        {isFailed && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2 text-sm text-destructive mb-6" data-testid="analysis-failed">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            Analysis failed: {analysis.error_message || "Unknown error"}
          </div>
        )}

        {isRunning && !isCompleted && (
          <div className="text-center py-16 text-muted-foreground" data-testid="analysis-running">
            <Loader2 className="h-10 w-10 animate-spin mx-auto mb-3 text-primary" />
            <p className="font-medium">Analysis in progress...</p>
            <p className="text-sm mt-1">This may take a moment depending on dataset size.</p>
          </div>
        )}

        {!loading && !analysis && !isRunning && (
          <div className="text-center py-16 border border-dashed border-border rounded-xl" data-testid="no-analysis">
            <BarChart2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium mb-1">No analysis yet</p>
            <p className="text-sm text-muted-foreground mb-4">Run analysis to generate statistics and charts</p>
            <Button className="gradient-indigo text-white gap-2" onClick={triggerAnalysis} disabled={triggering}>
              <Play className="h-4 w-4" /> Run Analysis
            </Button>
          </div>
        )}

        {isCompleted && (
          <>
            {/* Overview stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <QualityScore score={r.data_quality_score} />
              <StatCard label="Total Rows" value={r.row_count?.toLocaleString()} />
              <StatCard label="Columns" value={r.column_count} sub={`${r.numeric_columns?.length || 0} numeric, ${r.categorical_columns?.length || 0} categorical`} />
              <StatCard label="Duplicate Rows" value={r.duplicate_rows} color={r.duplicate_rows > 0 ? "text-amber-500" : "text-green-500"} />
            </div>

            <Tabs defaultValue="charts">
              <TabsList className="mb-4">
                <TabsTrigger value="charts" data-testid="charts-tab">Charts ({charts.length})</TabsTrigger>
                <TabsTrigger value="numeric" data-testid="numeric-tab">Numeric Stats</TabsTrigger>
                <TabsTrigger value="categorical" data-testid="categorical-tab">Categorical</TabsTrigger>
                <TabsTrigger value="missing" data-testid="missing-tab">Missing Values</TabsTrigger>
              </TabsList>

              <TabsContent value="charts">
                {charts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No charts generated (dataset may be purely text-based).</p>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {charts.map(c => <ChartCard key={c.chart_id} chart={c} />)}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="numeric">
                {Object.keys(numericSummaries).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No numeric columns found.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-border" data-testid="numeric-table">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/50">
                          {["Column","Count","Min","Max","Mean","Median","Std Dev","Outliers"].map(h => (
                            <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground border-b border-border whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(numericSummaries).map(([col, s], i) => (
                          <tr key={col} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                            <td className="px-3 py-2 font-medium border-b border-border/50">{col}</td>
                            <td className="px-3 py-2 font-mono border-b border-border/50">{s.count?.toLocaleString()}</td>
                            <td className="px-3 py-2 font-mono border-b border-border/50">{s.min?.toFixed(2)}</td>
                            <td className="px-3 py-2 font-mono border-b border-border/50">{s.max?.toFixed(2)}</td>
                            <td className="px-3 py-2 font-mono border-b border-border/50">{s.mean?.toFixed(2)}</td>
                            <td className="px-3 py-2 font-mono border-b border-border/50">{s.median?.toFixed(2)}</td>
                            <td className="px-3 py-2 font-mono border-b border-border/50">{s.std?.toFixed(2)}</td>
                            <td className={`px-3 py-2 font-mono border-b border-border/50 ${s.outlier_count > 0 ? "text-amber-500" : ""}`}>{s.outlier_count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="categorical">
                {Object.keys(catSummaries).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No categorical columns found.</p>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {Object.entries(catSummaries).map(([col, s]) => (
                      <div key={col} className="p-4 rounded-xl bg-card border border-border/50">
                        <h3 className="text-sm font-semibold mb-2">{col}</h3>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                          <span>{s.unique_count} unique values</span>
                          {s.null_count > 0 && <span className="text-amber-500">{s.null_count} nulls</span>}
                        </div>
                        <div className="space-y-1">
                          {Object.entries(s.top_values || {}).slice(0, 8).map(([val, count]) => {
                            const total = Object.values(s.top_values).reduce((a, b) => a + b, 0);
                            const pct = Math.round(count / total * 100);
                            return (
                              <div key={val} className="flex items-center gap-2 text-xs">
                                <span className="w-32 truncate text-muted-foreground">{val}</span>
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-muted-foreground w-8 text-right">{count}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="missing">
                <div className="overflow-x-auto rounded-xl border border-border" data-testid="missing-table">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50">
                        {["Column","Missing Count","Missing %","Status"].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground border-b border-border">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(r.missing_values || {}).map(([col, count], i) => {
                        const pct = r.missing_percentage?.[col] || 0;
                        return (
                          <tr key={col} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                            <td className="px-3 py-2 font-medium border-b border-border/50">{col}</td>
                            <td className="px-3 py-2 font-mono border-b border-border/50">{count?.toLocaleString()}</td>
                            <td className="px-3 py-2 font-mono border-b border-border/50">{pct}%</td>
                            <td className={`px-3 py-2 border-b border-border/50 ${count > 0 ? "text-amber-500" : "text-green-500"}`}>
                              {count === 0 ? "No missing" : pct > 30 ? "High missing" : "Low missing"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </Layout>
  );
}
