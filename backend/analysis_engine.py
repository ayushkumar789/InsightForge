"""
Deterministic analysis engine for CSV/XLSX datasets.
Includes:
  - Identifier/low-value column detection
  - Analytical relevance scoring
  - Smart chart recommendations
  - Better histogram binning
  - Time-series chart support
"""
import re
import math
import numpy as np
import pandas as pd
from typing import Any

# ── Identifier / analytical patterns ────────────────────────────────────────

_STRONG_ID = re.compile(
    r'^(id|uuid|guid|pk|row_id|record_id|_id|oid|gid|rid|'
    r'email|e_mail|phone|mobile|tel|fax|url|link|href|'
    r'hash|token|password|passwd|pwd|secret|api_key|apikey)$',
    re.IGNORECASE,
)
_ID_AFFIX = re.compile(
    r'(^id_|_id$|[-_]uuid$|[-_]guid$|[-_]key$|_no$|[-_]num$|[-_]ref$|'
    r'_token$|_hash$|_pk$|_fk$|_code$|_serial$|_seq$)',
    re.IGNORECASE,
)
_TEXT_LIKE = re.compile(
    r'(^name$|[-_]name$|^full[-_]?name|^first[-_]?name|^last[-_]?name|'
    r'^surname|^username|^login|description|^desc$|[-_]desc$|'
    r'comment|^note$|[-_]note$|^text$|^body$|^content$|^message$|'
    r'narration|remark|^address$|^addr$|street|filepath|filename|^path$)',
    re.IGNORECASE,
)
_MEASURE_HINT = re.compile(
    r'(price|amount|total|sum|revenue|cost|profit|loss|margin|'
    r'salary|income|expense|budget|balance|sales|volume|value|'
    r'weight|height|length|width|size|area|'
    r'quantity|qty|units|count|rate|score|grade|level|rank|priority|'
    r'percent|pct|ratio|proportion|frequency|'
    r'age|duration|days|hours|minutes|seconds|'
    r'rating|performance|productivity|efficiency|'
    r'temperature|pressure|speed|distance|depth)',
    re.IGNORECASE,
)
_DIMENSION_HINT = re.compile(
    r'(status|state|type|category|cat$|class$|group|segment|'
    r'tier|region|country|city|area|zone|territory|'
    r'department|dept|team|division|unit|'
    r'product|service|brand|channel|source|platform|medium|'
    r'gender|age_group|education|industry|sector|'
    r'is_|has_|flag|indicator)',
    re.IGNORECASE,
)


# ── JSON-safe helpers ────────────────────────────────────────────────────────

def _safe_float(v: Any) -> Any:
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    return v


def _sanitize(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(v) for v in obj]
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return _safe_float(float(obj))
    if isinstance(obj, float):
        return _safe_float(obj)
    if isinstance(obj, np.ndarray):
        return _sanitize(obj.tolist())
    if isinstance(obj, np.bool_):
        return bool(obj)
    return obj


# ── File loading ─────────────────────────────────────────────────────────────

def _load_dataframe(file_path: str, file_type: str, sheet: str = None):
    if file_type == "csv":
        try:
            df = pd.read_csv(file_path, low_memory=False)
        except UnicodeDecodeError:
            df = pd.read_csv(file_path, encoding="latin-1", low_memory=False)
        return df, None
    else:
        xl = pd.ExcelFile(file_path, engine="openpyxl")
        sheets = xl.sheet_names
        target = sheet if (sheet and sheet in sheets) else sheets[0]
        return xl.parse(target), sheets


def _detect_date_cols(df: pd.DataFrame) -> list:
    date_cols = []
    for col in df.select_dtypes(include=["object"]).columns:
        sample = df[col].dropna().head(50)
        if len(sample) == 0:
            continue
        try:
            parsed = pd.to_datetime(sample, infer_datetime_format=True, errors="coerce")
            if parsed.notna().sum() / len(sample) > 0.8:
                date_cols.append(col)
        except Exception:
            pass
    return date_cols


# ── Column scoring ───────────────────────────────────────────────────────────

def _score_column(col: str, series: pd.Series, n_rows: int) -> dict:
    """
    Score a column 0-100 for analytical usefulness.
    Also classifies whether it looks like an identifier/free-text.
    """
    col_lower = col.lower().strip()
    n_non_null = int(series.count())
    if n_non_null == 0:
        return {"score": 0, "is_identifier": False, "reason": "empty"}

    unique_count = int(series.nunique())
    uniqueness_ratio = unique_count / n_non_null

    # ── Strong identifier by name ──
    if _STRONG_ID.match(col_lower):
        return {"score": 5, "is_identifier": True, "reason": "identifier_name"}
    if _ID_AFFIX.search(col_lower):
        return {"score": 8, "is_identifier": True, "reason": "identifier_affix"}

    dtype_str = str(series.dtype)
    is_numeric = "int" in dtype_str or "float" in dtype_str

    # ── Numeric columns ──
    if is_numeric:
        # Near-unique integer → row ID
        if uniqueness_ratio > 0.95 and n_rows > 20:
            return {"score": 10, "is_identifier": True, "reason": "unique_integer"}
        s = series.dropna()
        std = float(s.std()) if len(s) > 1 else 0.0
        mean = float(s.mean()) if len(s) > 0 else 0.0
        # Near-constant
        if std == 0:
            return {"score": 15, "is_identifier": False, "reason": "constant"}
        # Binary (0/1 only)
        if unique_count <= 2:
            return {"score": 40, "is_identifier": False, "reason": "binary"}
        # Measure hint in name → boost
        if _MEASURE_HINT.search(col_lower):
            return {"score": 92, "is_identifier": False, "reason": "measure_hint"}
        # Default good numeric
        return {"score": 78, "is_identifier": False, "reason": "numeric"}

    # ── String / categorical ──
    if "object" in dtype_str or "category" in dtype_str:
        # High uniqueness → identifier or free text
        if uniqueness_ratio > 0.9 and n_rows > 30:
            # Also check avg string length
            avg_len = series.dropna().astype(str).str.len().mean()
            reason = "free_text" if avg_len > 40 else "high_uniqueness"
            return {"score": 12, "is_identifier": True, "reason": reason}

        # Text-like name + moderate uniqueness
        if _TEXT_LIKE.search(col_lower) and uniqueness_ratio > 0.25:
            return {"score": 18, "is_identifier": True, "reason": "text_pattern"}

        # Very high cardinality string (>70% unique but < 90%) — borderline
        if uniqueness_ratio > 0.7:
            return {"score": 28, "is_identifier": False, "reason": "high_cardinality"}

        # Dimension hint in name → boost
        if _DIMENSION_HINT.search(col_lower):
            return {"score": 88, "is_identifier": False, "reason": "dimension_hint"}

        # Ideal analytical cardinality (2 – 50)
        if 2 <= unique_count <= 50:
            return {"score": 80, "is_identifier": False, "reason": "good_cardinality"}

        # Medium cardinality (51 – 200)
        if unique_count <= 200:
            return {"score": 55, "is_identifier": False, "reason": "medium_cardinality"}

        # High cardinality (>200)
        return {"score": 30, "is_identifier": False, "reason": "high_cardinality_cat"}

    return {"score": 50, "is_identifier": False, "reason": "other"}


# ── Statistics helpers ───────────────────────────────────────────────────────

def _numeric_summary(series: pd.Series) -> dict:
    s = series.dropna()
    if len(s) == 0:
        return {"count": 0, "null_count": int(series.isna().sum())}
    q1, q3 = float(s.quantile(0.25)), float(s.quantile(0.75))
    iqr = q3 - q1
    lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    outliers = int(((s < lower) | (s > upper)).sum())
    return {
        "count": int(s.count()),
        "null_count": int(series.isna().sum()),
        "min": _safe_float(float(s.min())),
        "max": _safe_float(float(s.max())),
        "mean": _safe_float(float(s.mean())),
        "median": _safe_float(float(s.median())),
        "std": _safe_float(float(s.std())),
        "q1": _safe_float(q1),
        "q3": _safe_float(q3),
        "skewness": _safe_float(float(s.skew())),
        "outlier_count": outliers,
        "outlier_lower_bound": _safe_float(lower),
        "outlier_upper_bound": _safe_float(upper),
    }


def _categorical_summary(series: pd.Series) -> dict:
    vc = series.value_counts().head(15)
    return {
        "unique_count": int(series.nunique()),
        "null_count": int(series.isna().sum()),
        "top_values": {str(k): int(v) for k, v in vc.items()},
        "most_common": str(vc.index[0]) if len(vc) > 0 else None,
    }


# ── Smart histogram binning ──────────────────────────────────────────────────

def _smart_bins(series: pd.Series) -> int:
    s = series.dropna()
    n = len(s)
    if n <= 20:
        return 5
    # Freedman-Diaconis rule
    q75, q25 = np.percentile(s, [75, 25])
    iqr = q75 - q25
    if iqr > 0:
        bw = 2.0 * iqr / (n ** (1.0 / 3.0))
        data_range = float(s.max() - s.min())
        fd_bins = int(data_range / bw) if bw > 0 else 10
    else:
        fd_bins = 10
    # Sturges rule as fallback lower bound
    sturges = int(np.log2(n)) + 1
    return max(5, min(20, max(sturges, min(fd_bins, 25))))


def _fmt_bin_edge(v: float) -> str:
    """Format a bin edge cleanly: avoid scientific notation, limit decimals."""
    if v == 0:
        return "0"
    abs_v = abs(v)
    if abs_v >= 1_000_000:
        return f"{v/1_000_000:.1f}M"
    if abs_v >= 1_000:
        return f"{v/1_000:.1f}K"
    if abs_v >= 100:
        return f"{v:.0f}"
    if abs_v >= 10:
        return f"{v:.1f}"
    return f"{v:.2f}"


# ── Chart builders ───────────────────────────────────────────────────────────

def _histogram(df: pd.DataFrame, col: str) -> dict | None:
    s = df[col].dropna()
    if len(s) < 5:
        return None
    n_bins = _smart_bins(s)
    counts, edges = np.histogram(s, bins=n_bins)
    data = [
        {"range": f"{_fmt_bin_edge(edges[i])}-{_fmt_bin_edge(edges[i+1])}", "count": int(counts[i])}
        for i in range(len(counts))
    ]
    return {
        "chart_id": f"hist_{col}",
        "type": "histogram",
        "title": f"Distribution of {col}",
        "x_col": col,
        "data": data,
    }


def _bar_count(df: pd.DataFrame, col: str, max_cats: int = 15) -> dict | None:
    vc = df[col].value_counts().head(max_cats)
    if len(vc) < 2:
        return None
    # Use horizontal bar when many categories or long labels
    avg_label_len = np.mean([len(str(x)) for x in vc.index])
    use_horizontal = len(vc) > 6 or avg_label_len > 10
    data = [{"category": str(k), "count": int(v)} for k, v in vc.items()]
    return {
        "chart_id": f"bar_{col}",
        "type": "bar_h" if use_horizontal else "bar",
        "title": f"Distribution of {col}",
        "x_col": col,
        "data": data,
    }


def _grouped_bar(df: pd.DataFrame, cat_col: str, num_col: str, max_cats: int = 12) -> dict | None:
    try:
        grouped = (
            df.groupby(cat_col)[num_col]
            .agg(["mean", "count"])
            .reset_index()
            .sort_values("mean", ascending=False)
            .head(max_cats)
        )
        if len(grouped) < 2:
            return None
        avg_label_len = np.mean([len(str(x)) for x in grouped[cat_col]])
        use_horizontal = len(grouped) > 6 or avg_label_len > 10
        data = [
            {"category": str(r[cat_col]), "value": _safe_float(round(float(r["mean"]), 2))}
            for _, r in grouped.iterrows()
        ]
        return {
            "chart_id": f"grouped_{cat_col}_{num_col}",
            "type": "bar_grouped_h" if use_horizontal else "bar_grouped",
            "title": f"Avg {num_col} by {cat_col}",
            "x_col": cat_col,
            "y_col": num_col,
            "data": data,
        }
    except Exception:
        return None


def _scatter(df: pd.DataFrame, x_col: str, y_col: str) -> dict | None:
    sample = df[[x_col, y_col]].dropna().head(600)
    if len(sample) < 10:
        return None
    # Downsample if needed for clean rendering
    if len(sample) > 500:
        sample = sample.sample(500, random_state=42)
    data = [
        {"x": _safe_float(float(r[x_col])), "y": _safe_float(float(r[y_col]))}
        for _, r in sample.iterrows()
    ]
    return {
        "chart_id": f"scatter_{x_col}_{y_col}",
        "type": "scatter",
        "title": f"{x_col} vs {y_col}",
        "x_col": x_col,
        "y_col": y_col,
        "data": data,
    }


def _correlation_heatmap(df: pd.DataFrame, cols: list) -> dict | None:
    if len(cols) < 2:
        return None
    corr = df[cols].corr()
    matrix = [
        [_safe_float(round(float(corr.loc[r, c]), 3)) for c in cols]
        for r in cols
    ]
    return {
        "chart_id": "heatmap_correlation",
        "type": "heatmap",
        "title": "Correlation Matrix",
        "labels": cols,
        "matrix": matrix,
    }


def _time_series(df: pd.DataFrame, date_col: str, num_col: str) -> dict | None:
    try:
        df_ts = df[[date_col, num_col]].copy()
        df_ts[date_col] = pd.to_datetime(df_ts[date_col], errors="coerce")
        df_ts = df_ts.dropna()
        if len(df_ts) < 5:
            return None
        date_range_days = (df_ts[date_col].max() - df_ts[date_col].min()).days
        if date_range_days > 365 * 2:
            period, fmt = "Y", "%Y"
        elif date_range_days > 60:
            period, fmt = "M", "%b %Y"
        else:
            period, fmt = "W", "%b %d"
        df_ts["_period"] = df_ts[date_col].dt.to_period(period).dt.start_time
        grouped = df_ts.groupby("_period")[num_col].mean().reset_index()
        if len(grouped) < 3:
            return None
        data = [
            {"date": row["_period"].strftime(fmt), "value": _safe_float(round(float(row[num_col]), 2))}
            for _, row in grouped.iterrows()
        ]
        return {
            "chart_id": f"line_{date_col}_{num_col}",
            "type": "line",
            "title": f"{num_col} over time ({date_col})",
            "x_col": date_col,
            "y_col": num_col,
            "data": data,
        }
    except Exception:
        return None


# ── Smart chart builder ───────────────────────────────────────────────────────

def _build_charts_smart(
    df: pd.DataFrame,
    analytical_numeric: list,
    analytical_cat: list,
    date_cols: list,
    n_rows: int,
) -> list:
    charts = []

    # 1. Time series — highest priority when a date col exists
    if date_cols and analytical_numeric:
        c = _time_series(df, date_cols[0], analytical_numeric[0])
        if c:
            charts.append(c)

    # 2. Histograms for top analytical numeric cols
    hist_count = 0
    for col in analytical_numeric:
        if hist_count >= 4:
            break
        c = _histogram(df, col)
        if c:
            charts.append(c)
            hist_count += 1

    # 3. Categorical count bar for top analytical cat cols
    bar_count = 0
    for col in analytical_cat:
        if bar_count >= 2:
            break
        c = _bar_count(df, col)
        if c:
            charts.append(c)
            bar_count += 1

    # 4. Category × Metric grouped bar (best combo)
    if analytical_cat and analytical_numeric:
        # Pick the cat col with lowest cardinality first (most readable)
        best_cat = min(analytical_cat[:3], key=lambda c: df[c].nunique())
        best_num = analytical_numeric[0]
        c = _grouped_bar(df, best_cat, best_num)
        if c:
            charts.append(c)

    # 5. Scatter for most correlated numeric pair (more insightful than arbitrary first two)
    if len(analytical_numeric) >= 2:
        best_pair, best_corr = (analytical_numeric[0], analytical_numeric[1]), 0
        candidates = analytical_numeric[:8]  # limit search space
        if len(candidates) >= 2:
            try:
                corr_mat = df[candidates].corr().abs()
                np.fill_diagonal(corr_mat.values, 0)  # ignore self-correlation
                max_idx = corr_mat.values.argmax()
                i_r, i_c = divmod(max_idx, len(candidates))
                if corr_mat.values[i_r][i_c] > 0.15:  # only if meaningfully correlated
                    best_pair = (candidates[i_r], candidates[i_c])
            except Exception:
                pass
        c = _scatter(df, best_pair[0], best_pair[1])
        if c:
            charts.append(c)

    # 6. Correlation heatmap for 3+ analytical numeric cols
    hm_cols = analytical_numeric[:10]
    if len(hm_cols) >= 3:
        c = _correlation_heatmap(df, hm_cols)
        if c:
            charts.append(c)

    return charts


# ── Main entry point ─────────────────────────────────────────────────────────

def run_analysis_sync(file_path: str, file_type: str, sheet: str = None) -> dict:
    """
    Synchronous analysis — called via run_in_executor from async context.
    Returns a sanitized dict ready to store in MongoDB.
    """
    df, sheets = _load_dataframe(file_path, file_type, sheet)

    # Sample for very large datasets
    sampled = False
    if len(df) > 100_000:
        df_full = df.copy()
        df = df.sample(100_000, random_state=42)
        sampled = True
    else:
        df_full = df

    n_rows = len(df)

    # Raw column types
    all_numeric = df.select_dtypes(include="number").columns.tolist()
    all_cat = df.select_dtypes(include=["object", "category"]).columns.tolist()
    bool_cols = df.select_dtypes(include="bool").columns.tolist()
    date_cols = _detect_date_cols(df)
    all_cat = [c for c in all_cat if c not in date_cols]

    # Score every column
    column_scores: dict = {}
    for col in df.columns:
        column_scores[col] = _score_column(col, df[col], n_rows)

    identifier_cols = [c for c, s in column_scores.items() if s["is_identifier"]]

    # Analytical numeric: non-identifier, sorted by score descending
    analytical_numeric = sorted(
        [c for c in all_numeric if not column_scores[c]["is_identifier"]],
        key=lambda c: -column_scores[c]["score"],
    )
    # Analytical categorical: non-identifier, cardinality ≤ 200, sorted by score
    analytical_cat = sorted(
        [c for c in all_cat
         if not column_scores[c]["is_identifier"]
         and df[c].nunique() <= 200],
        key=lambda c: -column_scores[c]["score"],
    )
    # High-cardinality categorical (for separate display)
    high_card_cat = [
        c for c in all_cat
        if not column_scores[c]["is_identifier"] and df[c].nunique() > 200
    ]

    # Quality metrics
    total_cells = n_rows * len(df.columns)
    total_missing = int(df.isna().sum().sum())
    dup_count = int(df.duplicated().sum())
    missing_pct = (total_missing / total_cells * 100) if total_cells > 0 else 0
    dup_pct = (dup_count / n_rows * 100) if n_rows > 0 else 0
    data_quality_score = round(max(0, 100 - missing_pct * 0.7 - dup_pct * 0.3), 1)

    results = {
        # Basic
        "row_count": len(df_full),
        "column_count": len(df.columns),
        "columns": df.columns.tolist(),
        "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
        "sampled": sampled,

        # Typed columns
        "numeric_columns": all_numeric,
        "categorical_columns": all_cat,
        "date_columns": date_cols,
        "bool_columns": bool_cols,

        # Analytical sub-selections
        "analytical_numeric_columns": analytical_numeric,
        "analytical_categorical_columns": analytical_cat,
        "identifier_columns": identifier_cols,
        "high_cardinality_columns": {
            c: {"unique_count": int(df[c].nunique()),
                "uniqueness_ratio": round(df[c].nunique() / n_rows, 3)}
            for c in high_card_cat + identifier_cols
        },
        "column_scores": {c: s for c, s in column_scores.items()},

        # Missing
        "missing_values": {col: int(df[col].isna().sum()) for col in df.columns},
        "missing_percentage": {
            col: round(float(df[col].isna().sum() / n_rows * 100), 2)
            for col in df.columns
        } if n_rows > 0 else {},

        # Duplicates
        "duplicate_rows": dup_count,
        "duplicate_percentage": round(dup_pct, 2),

        # Quality
        "data_quality_score": data_quality_score,

        # Summaries (all columns, for completeness in stats tables)
        "numeric_summaries": {col: _numeric_summary(df[col]) for col in all_numeric},
        "categorical_summaries": {col: _categorical_summary(df[col]) for col in all_cat},

        # Correlation (analytical numeric only, max 12)
        "correlation_matrix": (
            {r: {c: _safe_float(round(float(v), 3)) for c, v in row.items()}
             for r, row in df[analytical_numeric[:12]].corr().to_dict().items()}
            if len(analytical_numeric) >= 2 else {}
        ),

        # Excel sheets
        "sheets": sheets,

        # Smart charts (analytical columns only)
        "charts": _build_charts_smart(df, analytical_numeric, analytical_cat, date_cols, n_rows),

        # Sample rows for insights
        "sample_rows": df.head(10).fillna("").astype(str).to_dict("records"),
    }

    return _sanitize(results)
