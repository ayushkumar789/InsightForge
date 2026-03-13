"""
Deterministic analysis engine for CSV/XLSX datasets.
Runs in thread pool executor to avoid blocking the event loop.
"""
import math
import numpy as np
import pandas as pd
from typing import Any


def _safe_float(v: Any) -> Any:
    """Convert NaN/Inf to None for JSON serialization."""
    if isinstance(v, float):
        if math.isnan(v) or math.isinf(v):
            return None
    return v


def _sanitize(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(v) for v in obj]
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return _safe_float(float(obj))
    if isinstance(obj, float):
        return _safe_float(obj)
    if isinstance(obj, np.ndarray):
        return _sanitize(obj.tolist())
    if isinstance(obj, np.bool_):
        return bool(obj)
    return obj


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


def _build_charts(df: pd.DataFrame, numeric_cols: list, cat_cols: list) -> list:
    charts = []

    # Histograms for top 4 numeric columns
    for col in numeric_cols[:4]:
        s = df[col].dropna()
        if len(s) < 2:
            continue
        n_bins = min(25, max(5, len(s.unique())))
        counts, edges = np.histogram(s, bins=n_bins)
        data = [
            {"range": f"{edges[i]:.2g}-{edges[i+1]:.2g}", "count": int(counts[i])}
            for i in range(len(counts))
        ]
        charts.append({
            "chart_id": f"hist_{col}",
            "type": "histogram",
            "title": f"Distribution of {col}",
            "x_col": col,
            "data": data,
        })

    # Scatter for first pair of numeric columns
    if len(numeric_cols) >= 2:
        x, y = numeric_cols[0], numeric_cols[1]
        sample = df[[x, y]].dropna().head(500)
        data = [{"x": _safe_float(float(r[x])), "y": _safe_float(float(r[y]))}
                for _, r in sample.iterrows()]
        charts.append({
            "chart_id": f"scatter_{x}_{y}",
            "type": "scatter",
            "title": f"{x} vs {y}",
            "x_col": x,
            "y_col": y,
            "data": data,
        })

    # Bar charts for categorical columns (top 2)
    for col in cat_cols[:2]:
        vc = df[col].value_counts().head(15)
        data = [{"category": str(k), "count": int(v)} for k, v in vc.items()]
        charts.append({
            "chart_id": f"bar_{col}",
            "type": "bar",
            "title": f"Distribution of {col}",
            "x_col": col,
            "data": data,
        })

    # Categorical × Numeric grouped bar
    if cat_cols and numeric_cols:
        c, n = cat_cols[0], numeric_cols[0]
        grouped = df.groupby(c)[n].mean().dropna().head(10)
        data = [{"category": str(k), "value": _safe_float(round(float(v), 2))}
                for k, v in grouped.items()]
        charts.append({
            "chart_id": f"grouped_{c}_{n}",
            "type": "bar_grouped",
            "title": f"Avg {n} by {c}",
            "x_col": c,
            "y_col": n,
            "data": data,
        })

    # Correlation heatmap (max 12 numeric cols)
    hm_cols = numeric_cols[:12]
    if len(hm_cols) >= 2:
        corr = df[hm_cols].corr()
        matrix = [
            [_safe_float(round(float(corr.loc[r, c]), 3)) for c in hm_cols]
            for r in hm_cols
        ]
        charts.append({
            "chart_id": "heatmap_correlation",
            "type": "heatmap",
            "title": "Correlation Matrix",
            "labels": hm_cols,
            "matrix": matrix,
        })

    return charts


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

    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
    bool_cols = df.select_dtypes(include="bool").columns.tolist()
    date_cols = _detect_date_cols(df)
    # Remove detected date cols from cat_cols
    cat_cols = [c for c in cat_cols if c not in date_cols]

    total_cells = len(df) * len(df.columns)
    total_missing = int(df.isna().sum().sum())
    dup_count = int(df.duplicated().sum())

    missing_pct = (total_missing / total_cells * 100) if total_cells > 0 else 0
    dup_pct = (dup_count / len(df) * 100) if len(df) > 0 else 0
    data_quality_score = round(max(0, 100 - missing_pct * 0.7 - dup_pct * 0.3), 1)

    results = {
        # Basic info
        "row_count": len(df_full),
        "column_count": len(df.columns),
        "columns": df.columns.tolist(),
        "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
        "sampled": sampled,

        # Column categories
        "numeric_columns": numeric_cols,
        "categorical_columns": cat_cols,
        "date_columns": date_cols,
        "bool_columns": bool_cols,

        # Missing values
        "missing_values": {col: int(df[col].isna().sum()) for col in df.columns},
        "missing_percentage": {
            col: round(float(df[col].isna().sum() / len(df) * 100), 2)
            for col in df.columns
        } if len(df) > 0 else {},

        # Duplicates
        "duplicate_rows": dup_count,
        "duplicate_percentage": round(dup_pct, 2),

        # Quality
        "data_quality_score": data_quality_score,

        # Summaries
        "numeric_summaries": {col: _numeric_summary(df[col]) for col in numeric_cols},
        "categorical_summaries": {col: _categorical_summary(df[col]) for col in cat_cols},

        # Correlation
        "correlation_matrix": (
            {r: {c: _safe_float(round(float(v), 3)) for c, v in row.items()}
             for r, row in df[numeric_cols[:12]].corr().to_dict().items()}
            if len(numeric_cols) >= 2 else {}
        ),

        # Sheets (Excel only)
        "sheets": sheets,

        # Charts
        "charts": _build_charts(df, numeric_cols, cat_cols),

        # Sample rows (first 10 for insights context)
        "sample_rows": df.head(10).fillna("").astype(str).to_dict("records"),
    }

    return _sanitize(results)
