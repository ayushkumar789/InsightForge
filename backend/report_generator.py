"""
PDF report generator using ReportLab.
Produces professional reports with dataset stats, analysis summary, and AI insights.
"""
import os
import io
import math
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
import numpy as np

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, Image as RLImage, PageBreak,
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT

logger = logging.getLogger(__name__)

UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "/app/uploads"))
REPORTS_DIR = UPLOAD_DIR / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

INDIGO = colors.HexColor("#6366f1")
DARK_BG = colors.HexColor("#09090b")
GRAY = colors.HexColor("#64748b")
SUCCESS = colors.HexColor("#22c55e")
WARN = colors.HexColor("#f59e0b")
DANGER = colors.HexColor("#ef4444")
LIGHT = colors.HexColor("#f8fafc")
BORDER = colors.HexColor("#e2e8f0")


def _get_styles():
    base = getSampleStyleSheet()
    styles = {
        "title": ParagraphStyle("title", parent=base["Title"],
                                fontSize=26, textColor=DARK_BG,
                                spaceAfter=6, fontName="Helvetica-Bold"),
        "subtitle": ParagraphStyle("subtitle", parent=base["Normal"],
                                   fontSize=12, textColor=GRAY,
                                   spaceAfter=4),
        "h2": ParagraphStyle("h2", parent=base["Heading2"],
                              fontSize=14, textColor=DARK_BG,
                              spaceAfter=6, spaceBefore=12,
                              fontName="Helvetica-Bold"),
        "body": ParagraphStyle("body", parent=base["Normal"],
                               fontSize=10, textColor=colors.HexColor("#374151"),
                               spaceAfter=4, leading=15),
        "bullet": ParagraphStyle("bullet", parent=base["Normal"],
                                 fontSize=10, textColor=colors.HexColor("#374151"),
                                 leftIndent=16, bulletIndent=6,
                                 spaceAfter=3, leading=14),
        "caption": ParagraphStyle("caption", parent=base["Normal"],
                                  fontSize=8, textColor=GRAY, alignment=TA_CENTER),
        "label": ParagraphStyle("label", parent=base["Normal"],
                                fontSize=9, textColor=GRAY,
                                fontName="Helvetica-Bold"),
    }
    return styles


def _stat_table(data: list, col_widths=None) -> Table:
    style = TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), INDIGO),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
    ])
    t = Table(data, colWidths=col_widths or [4 * cm, 3 * cm, 3 * cm, 3 * cm, 3 * cm])
    t.setStyle(style)
    return t


def _generate_chart_image(chart: dict, width=400, height=220) -> Optional[io.BytesIO]:
    """Generate a matplotlib chart image, return BytesIO or None on error."""
    try:
        fig, ax = plt.subplots(figsize=(width / 96, height / 96), dpi=96)
        fig.patch.set_facecolor("#f8fafc")
        ax.set_facecolor("#f8fafc")
        ax.spines[["top", "right"]].set_visible(False)
        ax.tick_params(labelsize=7)

        ctype = chart.get("type")
        data = chart.get("data", [])

        if ctype == "histogram" and data:
            labels = [d["range"] for d in data]
            vals = [d["count"] for d in data]
            ax.bar(range(len(labels)), vals, color="#6366f1", alpha=0.85)
            ax.set_xticks(range(len(labels)))
            ax.set_xticklabels(labels, rotation=45, ha="right", fontsize=6)
            ax.set_title(chart.get("title", ""), fontsize=9, pad=4)
            ax.set_ylabel("Count", fontsize=7)

        elif ctype == "bar" and data:
            labels = [d["category"] for d in data]
            vals = [d["count"] for d in data]
            ax.barh(labels[::-1], vals[::-1], color="#6366f1", alpha=0.85)
            ax.set_title(chart.get("title", ""), fontsize=9, pad=4)
            ax.set_xlabel("Count", fontsize=7)

        elif ctype == "bar_grouped" and data:
            labels = [d["category"] for d in data]
            vals = [d.get("value", 0) or 0 for d in data]
            ax.bar(range(len(labels)), vals, color="#06b6d4", alpha=0.85)
            ax.set_xticks(range(len(labels)))
            ax.set_xticklabels(labels, rotation=30, ha="right", fontsize=7)
            ax.set_title(chart.get("title", ""), fontsize=9, pad=4)

        elif ctype == "scatter" and data:
            xs = [d.get("x") for d in data if d.get("x") is not None]
            ys = [d.get("y") for d in data if d.get("y") is not None]
            ax.scatter(xs, ys, alpha=0.5, s=10, color="#6366f1")
            ax.set_title(chart.get("title", ""), fontsize=9, pad=4)
            ax.set_xlabel(chart.get("x_col", ""), fontsize=7)
            ax.set_ylabel(chart.get("y_col", ""), fontsize=7)

        elif ctype == "heatmap":
            labels = chart.get("labels", [])
            matrix = chart.get("matrix", [])
            if labels and matrix:
                mat = np.array([[v if v is not None else 0 for v in row] for row in matrix])
                im = ax.imshow(mat, cmap="RdYlGn", vmin=-1, vmax=1, aspect="auto")
                ax.set_xticks(range(len(labels)))
                ax.set_yticks(range(len(labels)))
                ax.set_xticklabels(labels, rotation=45, ha="right", fontsize=7)
                ax.set_yticklabels(labels, fontsize=7)
                plt.colorbar(im, ax=ax, fraction=0.03)
                ax.set_title(chart.get("title", ""), fontsize=9, pad=4)
                for i in range(len(labels)):
                    for j in range(len(labels)):
                        val = mat[i][j]
                        ax.text(j, i, f"{val:.2f}", ha="center", va="center",
                                fontsize=6, color="black" if abs(val) < 0.7 else "white")

        else:
            plt.close(fig)
            return None

        plt.tight_layout()
        buf = io.BytesIO()
        fig.savefig(buf, format="png", bbox_inches="tight", dpi=96)
        plt.close(fig)
        buf.seek(0)
        return buf

    except Exception as e:
        logger.warning(f"Chart generation failed: {e}")
        plt.close("all")
        return None


def generate_report_pdf(
    report_id: str,
    dataset: dict,
    project: dict,
    workspace: dict,
    analysis: dict,
    insight: Optional[dict] = None,
) -> str:
    """
    Generate a PDF report. Returns the file path.
    """
    file_path = str(REPORTS_DIR / f"{report_id}.pdf")
    S = _get_styles()
    story = []

    r = analysis.get("results", {})
    ins = insight.get("insights", {}) if insight else {}

    def add_section(title):
        story.append(Spacer(1, 6))
        story.append(HRFlowable(width="100%", thickness=1, color=INDIGO, spaceAfter=4))
        story.append(Paragraph(title, S["h2"]))

    # ── Cover ────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 1 * cm))
    story.append(Paragraph("InsightForge", ParagraphStyle(
        "brand", fontSize=11, textColor=INDIGO, fontName="Helvetica-Bold")))
    story.append(Spacer(1, 0.5 * cm))
    story.append(Paragraph(f"Analytics Report", S["title"]))
    story.append(Paragraph(dataset.get("name", "Dataset Report"), S["subtitle"]))
    story.append(Spacer(1, 0.3 * cm))
    meta_data = [
        ["Workspace", workspace.get("name", "—"), "Project", project.get("name", "—")],
        ["File", dataset.get("original_filename", "—"), "Type", dataset.get("file_type", "—").upper()],
        ["Generated", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"), "Quality Score",
         f"{r.get('data_quality_score', '—')}%"],
    ]
    cover_tbl = Table(meta_data, colWidths=[3 * cm, 6 * cm, 3 * cm, 5 * cm])
    cover_tbl.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), GRAY),
        ("TEXTCOLOR", (2, 0), (2, -1), GRAY),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(cover_tbl)

    # ── Dataset Overview ─────────────────────────────────────────────────────
    add_section("Dataset Overview")
    overview = [
        ["Metric", "Value"],
        ["Total Rows", f"{r.get('row_count', '—'):,}" if r.get('row_count') else "—"],
        ["Total Columns", str(r.get('column_count', '—'))],
        ["Numeric Columns", str(len(r.get('numeric_columns', [])))],
        ["Categorical Columns", str(len(r.get('categorical_columns', [])))],
        ["Duplicate Rows", f"{r.get('duplicate_rows', 0):,}"],
        ["Data Quality Score", f"{r.get('data_quality_score', '—')}%"],
    ]
    story.append(_stat_table(overview, col_widths=[8 * cm, 9 * cm]))

    # ── Missing Values ───────────────────────────────────────────────────────
    missing_pct = r.get("missing_percentage", {})
    cols_with_missing = [(col, pct) for col, pct in missing_pct.items() if pct and float(pct) > 0]
    if cols_with_missing:
        add_section("Missing Values")
        mv_data = [["Column", "Missing %"]]
        for col, pct in sorted(cols_with_missing, key=lambda x: -float(x[1]))[:20]:
            mv_data.append([col, f"{pct}%"])
        story.append(_stat_table(mv_data, col_widths=[12 * cm, 5 * cm]))

    # ── Numeric Summaries ────────────────────────────────────────────────────
    num_sums = r.get("numeric_summaries", {})
    if num_sums:
        add_section("Numeric Column Statistics")
        ns_data = [["Column", "Min", "Max", "Mean", "Std Dev"]]
        for col, s in list(num_sums.items())[:15]:
            def fmt(v):
                if v is None:
                    return "—"
                try:
                    return f"{float(v):.2f}"
                except Exception:
                    return str(v)
            ns_data.append([col, fmt(s.get("min")), fmt(s.get("max")),
                             fmt(s.get("mean")), fmt(s.get("std"))])
        story.append(_stat_table(ns_data))

    # ── Charts ───────────────────────────────────────────────────────────────
    charts = r.get("charts", [])
    if charts:
        add_section("Visualizations")
        chart_count = 0
        for chart in charts[:6]:
            buf = _generate_chart_image(chart, width=440, height=230)
            if buf:
                story.append(Spacer(1, 4))
                img = RLImage(buf, width=14 * cm, height=7.5 * cm)
                story.append(img)
                story.append(Paragraph(chart.get("title", ""), S["caption"]))
                story.append(Spacer(1, 4))
                chart_count += 1
                if chart_count % 2 == 0:
                    story.append(Spacer(1, 6))

    # ── AI Insights ──────────────────────────────────────────────────────────
    if ins:
        story.append(PageBreak())
        add_section("AI-Powered Insights")

        if ins.get("executive_summary"):
            story.append(Paragraph("Executive Summary", S["label"]))
            story.append(Paragraph(ins["executive_summary"], S["body"]))
            story.append(Spacer(1, 6))

        if ins.get("plain_language_summary"):
            story.append(Paragraph("Business Summary", S["label"]))
            story.append(Paragraph(ins["plain_language_summary"], S["body"]))
            story.append(Spacer(1, 6))

        for section, label in [
            ("key_trends", "Key Trends"),
            ("business_insights", "Business Insights"),
            ("anomalies", "Anomalies & Patterns"),
            ("recommendations", "Recommendations"),
            ("data_quality_notes", "Data Quality Notes"),
        ]:
            items = ins.get(section, [])
            if items:
                story.append(Paragraph(label, S["label"]))
                for item in items:
                    story.append(Paragraph(f"• {item}", S["bullet"]))
                story.append(Spacer(1, 6))

    # ── Build PDF ────────────────────────────────────────────────────────────
    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(GRAY)
        canvas.drawString(2 * cm, 1 * cm, "Generated by InsightForge")
        canvas.drawRightString(
            A4[0] - 2 * cm, 1 * cm,
            f"Page {doc.page} · {datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
        )
        canvas.restoreState()

    doc = SimpleDocTemplate(
        file_path,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return file_path
