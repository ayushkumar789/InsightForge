import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import Layout from "../components/Layout";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";
import {
  BarChart, Bar, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from "recharts";
import {
  ArrowLeft, Play, BarChart2, Loader2, AlertCircle, CheckCircle2,
  Info, Tag,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const PALETTE = ["#6366f1", "#06b6d4", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

// ── Number tick formatter ────────────────────────────────────────────────────
function fmtNum(v) {
  if (v === null || v === undefined) return "";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  if (Number.isInteger(v)) return String(v);
  return parseFloat(v.toFixed(2)).toString();
}

// Truncate long category labels for axis
function truncLabel(s, max = 12) {
  const str = String(s ?? "");
  return str.length > max ? str.slice(0, max) + "…" : str;
}

const TOOLTIP_STYLE = {
  background: "var(--card)",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--foreground)",
};

// ── Stat cards ───────────────────────────────────────────────────────────────
function QualityScore({ score }) {
  const color = score >= 80 ? "text-green-500" : score >= 60 ? "text-amber-500" : "text-red-500";
  const bg = score >= 80 ? "from-green-500/10" : score >= 60 ? "from-amber-500/10" : "from-red-500/10";
  return (
    <div className={`p-4 rounded-xl bg-card border border-border/50 text-center bg-gradient-to-br ${bg} to-transparent`}>
      <p className={`text-3xl font-bold ${color}`}>{score}%</p>
      <p className="text-xs text-muted-foreground mt-1">Data Quality Score</p>
    </div>
  );
}

function StatCard({ label, value, sub, color = "" }) {
  return (
    <div className="p-4 rounded-xl bg-card border border-border/50">
      <div className={`text-xl font-bold ${color}`}>{value ?? "—"}</div>
      <p className="text-xs font-medium mt-0.5">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Heatmap (custom grid) ───────────────────────────────────────────────────
function HeatmapChart({ chart }) {
  const { labels = [], matrix = [] } = chart;
  const n = labels.length;
  const cellSize = Math.max(36, Math.min(64, Math.floor(520 / (n + 1))));
  const getColor = (v) => {
    if (v == null) return "hsl(var(--muted))";
    if (v >= 0.7) return "#22c55e";
    if (v >= 0.4) return "#86efac";
    if (v >= 0.1) return "#d1fae5";
    if (v >= -0.1) return "hsl(var(--muted))";
    if (v >= -0.4) return "#fecaca";
    if (v >= -0.7) return "#f87171";
    return "#ef4444";
  };
  const textColor = (v) => (v == null || Math.abs(v) < 0.5 ? "inherit" : "white");
  return (
    <div className="overflow-x-auto">
      <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: `auto repeat(${n}, ${cellSize}px)` }}>
        <div />
        {labels.map((l) => (
          <div key={l} className="text-center text-xs text-muted-foreground pb-1 font-medium" style={{ width: cellSize }}>
            <span className="block truncate px-0.5" title={l}>{truncLabel(l, 8)}</span>
          </div>
        ))}
        {matrix.map((row, i) => (
          <React.Fragment key={i}>
            <div className="text-right pr-2 flex items-center text-xs text-muted-foreground font-medium" style={{ maxWidth: 100 }}>
              <span className="truncate" title={labels[i]}>{truncLabel(labels[i], 10)}</span>
            </div>
            {row.map((val, j) => (
              <div
                key={j}
                title={`${labels[i]} × ${labels[j]}: ${val}`}
                style={{ background: getColor(val), width: cellSize, height: cellSize, color: textColor(val) }}
                className="flex items-center justify-center text-xs font-mono rounded-sm cursor-default transition-opacity hover:opacity-80"
              >
                {val != null ? val.toFixed(2) : ""}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ── Universal ChartCard ─────────────────────────────────────────────────────
function ChartCard({ chart }) {
  const type = chart.type;
  const isHorizontal = type === "bar_h" || type === "bar_grouped_h";
  const isBar = type === "bar" || type === "bar_grouped" || isHorizontal;
  const fillColor = type.startsWith("bar_grouped") ? PALETTE[1] : PALETTE[0];
  const dataKey = type.includes("grouped") ? "value" : "count";
  const chartHeight = isHorizontal ? Math.max(180, Math.min(360, (chart.data?.length || 8) * 26 + 40)) : 230;

  // Tooltip formatter
  const fmtTooltip = (value, name) => [fmtNum(value), name === "count" ? "Count" : name === "value" ? chart.y_col : name];

  return (
    <div className="p-4 rounded-xl bg-card border border-border/50 flex flex-col" data-testid={`chart-${chart.chart_id}`}>
      <h3 className="text-sm font-semibold mb-1 text-foreground">{chart.title}</h3>
      {chart.x_col && chart.y_col && (
        <p className="text-xs text-muted-foreground mb-3">{chart.x_col} · {chart.y_col}</p>
      )}
      {!chart.x_col && !chart.y_col && chart.x_col && (
        <p className="text-xs text-muted-foreground mb-3">{chart.x_col}</p>
      )}

      {/* HISTOGRAM */}
      {type === "histogram" && (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={chart.data} margin={{ top: 4, right: 8, bottom: 28, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="range"
              tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
              angle={-35}
              textAnchor="end"
              height={50}
              interval={Math.ceil((chart.data?.length || 1) / 8)}
            />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={fmtNum} width={42} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [fmtNum(v), "Count"]} />
            <Bar dataKey="count" fill={PALETTE[0]} radius={[3, 3, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* VERTICAL BAR */}
      {(type === "bar" || type === "bar_grouped") && (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={chart.data} margin={{ top: 4, right: 8, bottom: 28, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="category"
              tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
              angle={chart.data?.length > 5 ? -30 : 0}
              textAnchor={chart.data?.length > 5 ? "end" : "middle"}
              height={chart.data?.length > 5 ? 50 : 30}
              tickFormatter={(v) => truncLabel(v, 14)}
            />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={fmtNum} width={42} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={fmtTooltip} labelStyle={{ fontWeight: 600 }} />
            <Bar dataKey={dataKey} fill={fillColor} radius={[3, 3, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* HORIZONTAL BAR */}
      {isHorizontal && (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={chart.data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={fmtNum} />
            <YAxis
              type="category"
              dataKey="category"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v) => truncLabel(v, 18)}
              width={110}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={fmtTooltip} />
            <Bar dataKey={dataKey} fill={fillColor} radius={[0, 3, 3, 0]} maxBarSize={20} />
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* SCATTER */}
      {type === "scatter" && (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <ScatterChart margin={{ top: 4, right: 16, bottom: 20, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="x"
              name={chart.x_col}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={fmtNum}
              type="number"
              label={{ value: chart.x_col, position: "insideBottom", offset: -8, fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis
              dataKey="y"
              name={chart.y_col}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={fmtNum}
              width={44}
              label={{ value: chart.y_col, angle: -90, position: "insideLeft", offset: 12, fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              contentStyle={TOOLTIP_STYLE}
              formatter={(v, name) => [fmtNum(v), name === "x" ? chart.x_col : chart.y_col]}
            />
            <Scatter data={chart.data} fill={PALETTE[0]} opacity={0.65} />
          </ScatterChart>
        </ResponsiveContainer>
      )}

      {/* LINE (time series) */}
      {type === "line" && (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <LineChart data={chart.data} margin={{ top: 4, right: 16, bottom: 28, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
              angle={-30}
              textAnchor="end"
              height={50}
              interval={Math.ceil((chart.data?.length || 1) / 8)}
            />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={fmtNum} width={44} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [fmtNum(v), chart.y_col]} />
            <Line type="monotone" dataKey="value" stroke={PALETTE[0]} dot={chart.data?.length < 40} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* HEATMAP */}
      {type === "heatmap" && <HeatmapChart chart={chart} />}
    </div>
  );
}

// ── Categorical section with high-cardinality split ──────────────────────────
function CategoricalTab({ catSummaries, analyticalCatCols, identifierCols, highCardCols }) {
  const [showIdentifiers, setShowIdentifiers] = useState(false);

  // Order: analytical first, then high-card
  const analyticalEntries = (analyticalCatCols || []).filter(c => catSummaries[c]);
  const highCardEntries = Object.keys(highCardCols || {}).filter(c => catSummaries[c]);
  const idEntries = (identifierCols || []).filter(c => catSummaries[c]);

  if (Object.keys(catSummaries).length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-10">No categorical columns found.</p>;
  }

  return (
    <div className="space-y-6">
      {analyticalEntries.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
            Analytical Dimensions ({analyticalEntries.length})
          </h3>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {analyticalEntries.map((col) => {
              const s = catSummaries[col];
              return (
                <div key={col} className="p-4 rounded-xl bg-card border border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold truncate">{col}</h4>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">{s.unique_count} unique</span>
                  </div>
                  {s.null_count > 0 && (
                    <p className="text-xs text-amber-500 mb-2">{s.null_count} nulls</p>
                  )}
                  <div className="space-y-1.5">
                    {Object.entries(s.top_values || {}).slice(0, 8).map(([val, count]) => {
                      const total = Object.values(s.top_values).reduce((a, b) => a + b, 0);
                      const pct = total > 0 ? Math.round(count / total * 100) : 0;
                      return (
                        <div key={val} className="flex items-center gap-2 text-xs">
                          <span className="w-28 truncate text-muted-foreground" title={val}>{val}</span>
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-muted-foreground w-8 text-right tabular-nums">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(highCardEntries.length > 0 || idEntries.length > 0) && (
        <div>
          <button
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
            onClick={() => setShowIdentifiers(!showIdentifiers)}
            data-testid="show-identifier-cols-toggle"
          >
            <Tag className="h-3.5 w-3.5" />
            <span>
              {showIdentifiers ? "Hide" : "Show"} identifier / high-cardinality columns
              ({highCardEntries.length + idEntries.length})
            </span>
          </button>
          {showIdentifiers && (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 opacity-70">
              {[...highCardEntries, ...idEntries].map((col) => {
                const s = catSummaries[col];
                if (!s) return null;
                return (
                  <div key={col} className="p-4 rounded-xl bg-muted/40 border border-border/30">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium truncate text-muted-foreground">{col}</h4>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">{s.unique_count} unique</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {idEntries.includes(col) ? "Identifier-like column" : "High cardinality — not shown in charts"}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
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
      const dsRes = await axios.get(`${API}/datasets/${datasetId}`);
      setDataset(dsRes.data);
      try {
        const anaRes = await axios.get(`${API}/datasets/${datasetId}/analysis`);
        setAnalysis(anaRes.data);
      } catch {}
    } catch { toast.error("Dataset not found"); }
    finally { setLoading(false); }
  }, [datasetId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const running = analysis?.status === "pending" || analysis?.status === "running"
      || dataset?.status === "processing";
    if (running) {
      pollRef.current = setInterval(fetchData, 3000);
    } else {
      clearInterval(pollRef.current);
    }
    return () => clearInterval(pollRef.current);
  }, [analysis?.status, dataset?.status, fetchData]);

  const triggerAnalysis = async () => {
    setTriggering(true);
    try {
      await axios.post(`${API}/datasets/${datasetId}/analyze`, {});
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
  const analyticalNumCols = r.analytical_numeric_columns || r.numeric_columns || [];
  const analyticalCatCols = r.analytical_categorical_columns || [];
  const identifierCols = r.identifier_columns || [];
  const highCardCols = r.high_cardinality_columns || {};
  const isCompleted = analysis?.status === "completed";
  const isRunning = analysis?.status === "pending" || analysis?.status === "running"
    || dataset?.status === "processing";
  const isFailed = analysis?.status === "failed";

  // Determine optimal chart grid cols hint (used in ChartCard grid)
  const singleWideCharts = charts.filter(c => c.type === "heatmap" || c.type === "line");
  const regularCharts = charts.filter(c => c.type !== "heatmap" && c.type !== "line");

  return (
    <Layout>
      <div className="p-6 w-full max-w-[1800px] mx-auto" data-testid="analysis-page">
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
              <Button variant="outline" size="sm"
                onClick={() => navigate(`/datasets/${datasetId}/insights`)}
                className="border-purple-300 text-purple-600 dark:border-purple-700 dark:text-purple-400 gap-1"
                data-testid="get-insights-btn"
              >
                Get AI Insights
              </Button>
            )}
          </div>
        </div>

        {loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        )}

        {isFailed && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2 text-sm text-destructive mb-6" data-testid="analysis-failed">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            Analysis failed: {analysis.error_message || "Unknown error"}
          </div>
        )}

        {isRunning && !isCompleted && (
          <div className="text-center py-20 text-muted-foreground" data-testid="analysis-running">
            <Loader2 className="h-10 w-10 animate-spin mx-auto mb-3 text-primary" />
            <p className="font-medium">Analysis in progress...</p>
            <p className="text-sm mt-1">This may take a moment depending on dataset size.</p>
          </div>
        )}

        {!loading && !analysis && !isRunning && (
          <div className="text-center py-20 border border-dashed border-border rounded-xl" data-testid="no-analysis">
            <BarChart2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium mb-1">No analysis yet</p>
            <p className="text-sm text-muted-foreground mb-4">Run deterministic analysis to generate statistics and charts</p>
            <Button className="gradient-indigo text-white gap-2" onClick={triggerAnalysis} disabled={triggering}>
              <Play className="h-4 w-4" /> Run Analysis
            </Button>
          </div>
        )}

        {isCompleted && (
          <>
            {/* Overview stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
              <QualityScore score={r.data_quality_score} />
              <StatCard label="Total Rows" value={r.row_count?.toLocaleString()} />
              <StatCard label="Columns" value={r.column_count}
                sub={`${analyticalNumCols.length} numeric · ${analyticalCatCols.length} categorical`} />
              <StatCard label="Duplicate Rows" value={r.duplicate_rows}
                color={r.duplicate_rows > 0 ? "text-amber-500" : "text-green-500"} />
              {identifierCols.length > 0 && (
                <StatCard label="ID-like Cols" value={identifierCols.length}
                  sub="excluded from charts" color="text-muted-foreground" />
              )}
              {r.date_columns?.length > 0 && (
                <StatCard label="Date Columns" value={r.date_columns.length} color="text-purple-500" />
              )}
            </div>

            {/* Identifier chip list */}
            {identifierCols.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap mb-4 p-3 rounded-lg bg-muted/40 border border-border/30">
                <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <Info className="h-3.5 w-3.5" />
                  Excluded from charts:
                </span>
                {identifierCols.map((c) => (
                  <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/50 font-mono">
                    {c}
                  </span>
                ))}
              </div>
            )}

            <Tabs defaultValue="charts">
              <TabsList className="mb-4 flex-wrap h-auto">
                <TabsTrigger value="charts" data-testid="charts-tab">
                  Charts {charts.length > 0 && `(${charts.length})`}
                </TabsTrigger>
                <TabsTrigger value="numeric" data-testid="numeric-tab">
                  Numeric Stats
                </TabsTrigger>
                <TabsTrigger value="categorical" data-testid="categorical-tab">
                  Categorical
                </TabsTrigger>
                <TabsTrigger value="missing" data-testid="missing-tab">
                  Missing Values
                </TabsTrigger>
              </TabsList>

              {/* ── Charts tab ── */}
              <TabsContent value="charts">
                {charts.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-border rounded-xl">
                    <BarChart2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No charts generated — dataset may lack analytical numeric or categorical columns.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Wide charts (heatmap, line) span full row */}
                    {singleWideCharts.map(c => (
                      <div key={c.chart_id} className="w-full">
                        <ChartCard chart={c} />
                      </div>
                    ))}
                    {/* Regular charts in responsive grid */}
                    {regularCharts.length > 0 && (
                      <div className="grid sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                        {regularCharts.map(c => <ChartCard key={c.chart_id} chart={c} />)}
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* ── Numeric stats tab ── */}
              <TabsContent value="numeric">
                {Object.keys(numericSummaries).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-10">No numeric columns found.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-border" data-testid="numeric-table">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/50 sticky top-0">
                          {["Column", "Type", "Count", "Min", "Max", "Mean", "Median", "Std Dev", "Outliers"].map(h => (
                            <th key={h} className="px-3 py-2.5 text-left font-semibold text-muted-foreground border-b border-border whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(numericSummaries).map(([col, s], i) => {
                          const isId = identifierCols.includes(col);
                          return (
                            <tr key={col} className={`${i % 2 === 0 ? "bg-background" : "bg-muted/20"} ${isId ? "opacity-50" : ""}`}>
                              <td className="px-3 py-2 font-medium border-b border-border/50">
                                {col}
                                {isId && <span className="ml-1.5 text-xs text-muted-foreground">(ID)</span>}
                              </td>
                              <td className="px-3 py-2 font-mono border-b border-border/50 text-muted-foreground">
                                {r.dtypes?.[col]?.replace("64", "").replace("32", "") || "—"}
                              </td>
                              <td className="px-3 py-2 font-mono border-b border-border/50 tabular-nums">{s.count?.toLocaleString()}</td>
                              <td className="px-3 py-2 font-mono border-b border-border/50 tabular-nums">{s.min != null ? fmtNum(s.min) : "—"}</td>
                              <td className="px-3 py-2 font-mono border-b border-border/50 tabular-nums">{s.max != null ? fmtNum(s.max) : "—"}</td>
                              <td className="px-3 py-2 font-mono border-b border-border/50 tabular-nums">{s.mean != null ? fmtNum(s.mean) : "—"}</td>
                              <td className="px-3 py-2 font-mono border-b border-border/50 tabular-nums">{s.median != null ? fmtNum(s.median) : "—"}</td>
                              <td className="px-3 py-2 font-mono border-b border-border/50 tabular-nums">{s.std != null ? fmtNum(s.std) : "—"}</td>
                              <td className={`px-3 py-2 font-mono border-b border-border/50 tabular-nums ${s.outlier_count > 0 ? "text-amber-500" : "text-green-600"}`}>
                                {s.outlier_count}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              {/* ── Categorical tab ── */}
              <TabsContent value="categorical">
                <CategoricalTab
                  catSummaries={catSummaries}
                  analyticalCatCols={analyticalCatCols}
                  identifierCols={identifierCols}
                  highCardCols={highCardCols}
                />
              </TabsContent>

              {/* ── Missing values tab ── */}
              <TabsContent value="missing">
                <div className="overflow-x-auto rounded-xl border border-border" data-testid="missing-table">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50 sticky top-0">
                        {["Column", "Missing Count", "Missing %", "Assessment"].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left font-semibold text-muted-foreground border-b border-border whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(r.missing_values || {})
                        .sort(([, a], [, b]) => b - a)
                        .map(([col, count], i) => {
                          const pct = r.missing_percentage?.[col] ?? 0;
                          const level = count === 0 ? "none" : pct > 30 ? "high" : pct > 5 ? "moderate" : "low";
                          const levelColor = { none: "text-green-600", low: "text-emerald-500", moderate: "text-amber-500", high: "text-red-500" }[level];
                          const levelLabel = { none: "Complete", low: "Low missing", moderate: "Moderate", high: "High missing" }[level];
                          return (
                            <tr key={col} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                              <td className="px-3 py-2 font-medium border-b border-border/50">{col}</td>
                              <td className="px-3 py-2 font-mono tabular-nums border-b border-border/50">{count?.toLocaleString()}</td>
                              <td className="px-3 py-2 border-b border-border/50">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-muted rounded-full max-w-[80px] overflow-hidden">
                                    <div className={`h-full rounded-full ${level === "none" ? "bg-green-500" : level === "high" ? "bg-red-500" : "bg-amber-500"}`}
                                      style={{ width: `${Math.min(pct, 100)}%` }} />
                                  </div>
                                  <span className="font-mono tabular-nums">{pct}%</span>
                                </div>
                              </td>
                              <td className={`px-3 py-2 border-b border-border/50 ${levelColor} font-medium`}>{levelLabel}</td>
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
