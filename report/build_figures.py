"""Render report figures from pipeline outputs.

Reads:
    data/processed/overlap_matrix.csv
    data/processed/gap_analysis.csv

Writes:
    report/figures/coverage_histogram.png
    report/figures/gap_heatmap.png

Also returns headline stats as a dict (consumed by aggregate_findings to inject
numbers into report.md).
"""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path
from typing import Any

import matplotlib
matplotlib.use("Agg")  # headless
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lib.config import REPO_ROOT  # noqa: E402

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

OVERLAP_PATH = REPO_ROOT / "data" / "processed" / "overlap_matrix.csv"
GAP_PATH = REPO_ROOT / "data" / "processed" / "gap_analysis.csv"
FIG_DIR = REPO_ROOT / "report" / "figures"

AGE_ORDER = ["0-2y", "3-5y", "6-10y", "10y+", "post-slr", "unknown"]
VENUE_ORDER = ["journal", "conference", "workshop", "preprint", "book", "unknown"]


def coverage_stats(overlap_df: pd.DataFrame) -> dict[str, Any]:
    df = overlap_df.copy()
    df["coverage_pct"] = pd.to_numeric(df["coverage_pct"], errors="coerce")
    df = df.dropna(subset=["coverage_pct"])
    if df.empty:
        return {"n_slrs": 0, "mean": None, "median": None, "min": None, "max": None}
    return {
        "n_slrs": int(len(df)),
        "mean": float(df["coverage_pct"].mean()),
        "median": float(df["coverage_pct"].median()),
        "min": float(df["coverage_pct"].min()),
        "max": float(df["coverage_pct"].max()),
    }


def render_coverage_histogram(overlap_df: pd.DataFrame, out_path: Path) -> Path:
    df = overlap_df.copy()
    df["coverage_pct"] = pd.to_numeric(df["coverage_pct"], errors="coerce")
    values = df["coverage_pct"].dropna()

    fig, ax = plt.subplots(figsize=(7, 4.5))
    ax.hist(values, bins=range(0, 101, 10), edgecolor="black", color="#4c78a8")
    ax.set_xlabel("Coverage of date-controlled top-cited corpus (%)")
    ax.set_ylabel("Number of SLRs")
    ax.set_title("SLR coverage of highly-cited technical-debt papers")
    if not values.empty:
        ax.axvline(values.mean(), color="red", linestyle="--", linewidth=1, label=f"mean={values.mean():.1f}%")
        ax.axvline(values.median(), color="orange", linestyle=":", linewidth=1, label=f"median={values.median():.1f}%")
        ax.legend()
    ax.set_xlim(0, 100)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.tight_layout()
    fig.savefig(out_path, dpi=160)
    plt.close(fig)
    return out_path


def gap_heatmap_matrix(gap_df: pd.DataFrame) -> pd.DataFrame:
    if gap_df.empty:
        return pd.DataFrame(index=VENUE_ORDER, columns=AGE_ORDER, data=0)
    pivot = (
        gap_df.assign(count=1)
        .pivot_table(index="venue_type", columns="age_bucket", values="count", aggfunc="sum", fill_value=0)
    )
    pivot = pivot.reindex(index=VENUE_ORDER, columns=AGE_ORDER, fill_value=0)
    return pivot


def render_gap_heatmap(gap_df: pd.DataFrame, out_path: Path) -> Path:
    matrix = gap_heatmap_matrix(gap_df)
    fig, ax = plt.subplots(figsize=(8, 5))
    im = ax.imshow(matrix.values, aspect="auto", cmap="YlOrRd")
    ax.set_xticks(range(len(matrix.columns)))
    ax.set_xticklabels(matrix.columns, rotation=30, ha="right")
    ax.set_yticks(range(len(matrix.index)))
    ax.set_yticklabels(matrix.index)
    ax.set_xlabel("Age of missed paper at SLR time")
    ax.set_ylabel("Venue type")
    ax.set_title("Missed highly-cited papers by venue and age")
    for i in range(matrix.shape[0]):
        for j in range(matrix.shape[1]):
            value = int(matrix.values[i, j])
            if value:
                ax.text(j, i, str(value), ha="center", va="center", color="black", fontsize=9)
    fig.colorbar(im, ax=ax, label="Missed pair count")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.tight_layout()
    fig.savefig(out_path, dpi=160)
    plt.close(fig)
    return out_path


def run(
    overlap_path: Path = OVERLAP_PATH,
    gap_path: Path = GAP_PATH,
    fig_dir: Path = FIG_DIR,
) -> dict[str, Any]:
    if not overlap_path.exists():
        raise FileNotFoundError(f"Missing overlap matrix: {overlap_path}. Run compute_overlap first.")
    overlap_df = pd.read_csv(overlap_path)
    gap_df = pd.read_csv(gap_path) if gap_path.exists() else pd.DataFrame(columns=["venue_type", "age_bucket"])

    fig_dir.mkdir(parents=True, exist_ok=True)
    hist_path = render_coverage_histogram(overlap_df, fig_dir / "coverage_histogram.png")
    heat_path = render_gap_heatmap(gap_df, fig_dir / "gap_heatmap.png")
    stats = coverage_stats(overlap_df)
    logger.info("Wrote %s and %s; stats=%s", hist_path, heat_path, stats)
    return stats


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--overlap", type=Path, default=OVERLAP_PATH)
    parser.add_argument("--gaps", type=Path, default=GAP_PATH)
    parser.add_argument("--out", type=Path, default=FIG_DIR)
    args = parser.parse_args()
    stats = run(args.overlap, args.gaps, args.out)
    print("Coverage stats:", stats)


if __name__ == "__main__":
    main()
