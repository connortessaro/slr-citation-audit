import csv
import json
import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "report"))
import build_figures as bf  # noqa: E402


def _overlap_df() -> pd.DataFrame:
    return pd.DataFrame([
        {"slr_id": "a", "coverage_pct": 60.0},
        {"slr_id": "b", "coverage_pct": 40.0},
        {"slr_id": "c", "coverage_pct": 80.0},
        {"slr_id": "d", "coverage_pct": ""},  # zero-eligible -> blank, drop
    ])


def _gap_df() -> pd.DataFrame:
    return pd.DataFrame([
        {"venue_type": "conference", "age_bucket": "3-5y"},
        {"venue_type": "conference", "age_bucket": "3-5y"},
        {"venue_type": "workshop", "age_bucket": "0-2y"},
        {"venue_type": "journal", "age_bucket": "6-10y"},
    ])


class TestCoverageStats:
    def test_drops_non_numeric(self):
        stats = bf.coverage_stats(_overlap_df())
        assert stats["n_slrs"] == 3
        assert stats["mean"] == pytest.approx(60.0)
        assert stats["median"] == pytest.approx(60.0)
        assert stats["min"] == pytest.approx(40.0)
        assert stats["max"] == pytest.approx(80.0)

    def test_empty(self):
        stats = bf.coverage_stats(pd.DataFrame(columns=["coverage_pct"]))
        assert stats == {"n_slrs": 0, "mean": None, "median": None, "min": None, "max": None}


class TestHeatmapMatrix:
    def test_pivot_shape_and_counts(self):
        matrix = bf.gap_heatmap_matrix(_gap_df())
        assert list(matrix.index) == bf.VENUE_ORDER
        assert list(matrix.columns) == bf.AGE_ORDER
        assert matrix.loc["conference", "3-5y"] == 2
        assert matrix.loc["workshop", "0-2y"] == 1
        assert matrix.loc["journal", "6-10y"] == 1
        assert matrix.loc["book", "10y+"] == 0

    def test_empty(self):
        matrix = bf.gap_heatmap_matrix(pd.DataFrame(columns=["venue_type", "age_bucket"]))
        assert matrix.values.sum() == 0


class TestRun:
    def test_writes_pngs_and_returns_stats(self, tmp_path: Path):
        overlap_path = tmp_path / "overlap.csv"
        gap_path = tmp_path / "gap.csv"
        fig_dir = tmp_path / "figures"

        _overlap_df().to_csv(overlap_path, index=False)
        _gap_df().to_csv(gap_path, index=False)

        stats = bf.run(overlap_path, gap_path, fig_dir)
        assert stats["n_slrs"] == 3
        assert (fig_dir / "coverage_histogram.png").exists()
        assert (fig_dir / "gap_heatmap.png").exists()
        # PNG files should be non-trivially sized
        assert (fig_dir / "coverage_histogram.png").stat().st_size > 1000

    def test_missing_overlap_raises(self, tmp_path: Path):
        with pytest.raises(FileNotFoundError):
            bf.run(tmp_path / "missing.csv", tmp_path / "gap.csv", tmp_path / "figs")

    def test_missing_gap_still_runs(self, tmp_path: Path):
        overlap_path = tmp_path / "overlap.csv"
        fig_dir = tmp_path / "figures"
        _overlap_df().to_csv(overlap_path, index=False)
        stats = bf.run(overlap_path, tmp_path / "no_gap.csv", fig_dir)
        assert stats["n_slrs"] == 3
        assert (fig_dir / "gap_heatmap.png").exists()
