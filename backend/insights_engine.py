"""
AI insights generation using Google Gemini via emergentintegrations.
Sends structured analysis summary to Gemini — NOT raw dataset rows.
"""
import os
import json
import uuid
import logging
from datetime import datetime, timezone
from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

SYSTEM_PROMPT = """You are an expert data analyst and business intelligence consultant.
Analyze dataset statistics and generate structured, actionable insights.
Always respond with valid JSON only — no markdown fences, no explanation outside JSON.
"""


def _build_prompt(dataset: dict, analysis: dict) -> str:
    r = analysis.get("results", {})
    numeric_summaries = r.get("numeric_summaries", {})
    categorical_summaries = r.get("categorical_summaries", {})

    # Build compact stats for prompt
    numeric_stats = "\n".join([
        f"  {col}: min={v.get('min')}, max={v.get('max')}, "
        f"mean={v.get('mean'):.2f if v.get('mean') else 'N/A'}, "
        f"std={v.get('std'):.2f if v.get('std') else 'N/A'}, "
        f"outliers={v.get('outlier_count', 0)}"
        for col, v in list(numeric_summaries.items())[:10]
    ])

    cat_stats = "\n".join([
        f"  {col}: {v.get('unique_count')} unique values, "
        f"top: {list(v.get('top_values', {}).keys())[:5]}"
        for col, v in list(categorical_summaries.items())[:8]
    ])

    missing = "\n".join([
        f"  {col}: {pct}% missing"
        for col, pct in r.get("missing_percentage", {}).items()
        if pct and float(pct) > 0
    ]) or "  No missing values"

    # Strong correlations
    corr_matrix = r.get("correlation_matrix", {})
    strong_corrs = []
    seen = set()
    for col1, row in corr_matrix.items():
        for col2, val in row.items():
            if col1 != col2 and val and abs(val) > 0.5:
                key = tuple(sorted([col1, col2]))
                if key not in seen:
                    seen.add(key)
                    strong_corrs.append(f"  {col1} ↔ {col2}: {val:.2f}")
    corr_text = "\n".join(strong_corrs[:10]) or "  No strong correlations found"

    sample_rows = r.get("sample_rows", [])
    sample_text = json.dumps(sample_rows[:5], indent=2) if sample_rows else "N/A"

    return f"""Dataset Analysis Report for: {dataset.get('name', 'Unknown')}
File: {dataset.get('original_filename', 'N/A')} ({dataset.get('file_type', '').upper()})

## Overview
- Rows: {r.get('row_count', 'N/A')} | Columns: {r.get('column_count', 'N/A')}
- Data Quality Score: {r.get('data_quality_score', 'N/A')}%
- Duplicate Rows: {r.get('duplicate_rows', 0)}
- Numeric Columns: {', '.join(r.get('numeric_columns', [])[:10])}
- Categorical Columns: {', '.join(r.get('categorical_columns', [])[:10])}

## Numeric Column Statistics
{numeric_stats or '  No numeric columns'}

## Categorical Column Statistics
{cat_stats or '  No categorical columns'}

## Missing Values
{missing}

## Strong Correlations (|r| > 0.5)
{corr_text}

## Sample Data (first 5 rows)
{sample_text}

---
Generate business insights as JSON with this exact structure:
{{
  "executive_summary": "2-3 sentence overview of the dataset and its key characteristics",
  "key_trends": ["trend 1", "trend 2", "trend 3"],
  "anomalies": ["anomaly or unusual pattern 1", "anomaly 2"],
  "business_insights": ["actionable insight 1", "actionable insight 2", "actionable insight 3"],
  "data_quality_notes": ["quality observation 1", "quality observation 2"],
  "recommendations": ["recommendation for further analysis 1", "recommendation 2"],
  "plain_language_summary": "2-3 sentence non-technical summary for business stakeholders"
}}
Provide specific, data-driven insights based on the actual statistics above."""


async def generate_insights(dataset: dict, analysis: dict) -> dict:
    """
    Generate AI insights using Gemini. Returns structured insights dict.
    Raises ValueError if API key is missing or generation fails.
    """
    if not GEMINI_API_KEY:
        raise ValueError(
            "GEMINI_API_KEY is not configured. Please add it to the backend .env file."
        )

    prompt = _build_prompt(dataset, analysis)

    chat = LlmChat(
        api_key=GEMINI_API_KEY,
        session_id=f"insight_{uuid.uuid4().hex}",
        system_message=SYSTEM_PROMPT,
    ).with_model("gemini", GEMINI_MODEL)

    response = await chat.send_message(UserMessage(text=prompt))

    # Parse JSON response
    raw = response.strip()
    # Remove potential markdown fences
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        logger.error(f"Gemini returned non-JSON: {raw[:500]}")
        # Return raw as summary
        parsed = {
            "executive_summary": raw[:500],
            "key_trends": [],
            "anomalies": [],
            "business_insights": [],
            "data_quality_notes": [],
            "recommendations": [],
            "plain_language_summary": raw[:300],
        }

    parsed["model_used"] = GEMINI_MODEL
    parsed["generated_at"] = datetime.now(timezone.utc).isoformat()
    return parsed
