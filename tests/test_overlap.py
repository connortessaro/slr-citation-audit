import csv
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "04_overlap"))
import compute_overlap as co  # noqa: E402
from date_controls import filter_by_year  # noqa: E402


class TestFilterByYear:
    def test_filters_papers_after_cutoff(self):
        papers = [{"year": 2010}, {"year": 2015}, {"year": 2020}]
        assert filter_by_year(papers, 2015) == [{"year": 2010}, {"year": 2015}]

    def test_drops_missing_year(self):
        papers = [{"year": 2010}, {"title": "no year"}]
        assert filter_by_year(papers, 2020) == [{"year": 2010}]

    def test_drops_non_int_year(self):
        papers = [{"year": "not-a-year"}, {"year": 2010}]
        assert filter_by_year(papers, 2020) == [{"year": 2010}]

    def test_none_cutoff_returns_all(self):
        papers = [{"year": 2010}, {"year": 2030}]
        assert filter_by_year(papers, None) == papers
        # Returns a copy, not the same list object
        assert filter_by_year(papers, None) is not papers


def _slr(key: str, year: int, ptype: str = "slr") -> dict:
    return {"_paper_key": key, "title": f"SLR {key}", "year": year, "venue": "EMSE", "_classification_type": ptype}


def _ref(key: str) -> dict:
    return {"paper_key": key}


def _top_cited(key: str, year: int, citations: int, rank: int) -> dict:
    return {
        "_paper_key": key,
        "title": f"Paper {key}",
        "year": year,
        "venue": "ICSE",
        "citationCount": citations,
        "_rank": rank,
    }


class TestCompute:
    def test_basic_overlap_and_date_control(self):
        corpus = [_slr("slr1", 2015)]
        refs_by_slr = {"slr1": [_ref("p1"), _ref("p3")]}
        top_cited = [
            _top_cited("p1", 2010, 100, 1),
            _top_cited("p2", 2018, 200, 2),  # excluded by date control (post-SLR)
            _top_cited("p3", 2012, 150, 3),
            _top_cited("p4", 2014, 90, 4),   # not cited by SLR -> miss
        ]
        overlap_rows, missed_rows = co.compute(corpus, refs_by_slr, top_cited)

        assert len(overlap_rows) == 1
        row = overlap_rows[0]
        assert row["eligible_top_n"] == 3  # p1, p3, p4 (p2 post-dates SLR)
        assert row["hits"] == 2
        assert row["misses"] == 1
        assert row["coverage_pct"] == round(2 / 3 * 100, 2)

        assert len(missed_rows) == 1
        assert missed_rows[0]["missed_paper_key"] == "p4"

    def test_zero_eligible_yields_blank_coverage(self):
        corpus = [_slr("slr1", 2005)]
        refs_by_slr = {"slr1": []}
        top_cited = [_top_cited("p1", 2010, 100, 1)]
        overlap_rows, missed_rows = co.compute(corpus, refs_by_slr, top_cited)
        assert overlap_rows[0]["eligible_top_n"] == 0
        assert overlap_rows[0]["coverage_pct"] == ""
        assert missed_rows == []

    def test_multiple_slrs_independent(self):
        corpus = [_slr("slr1", 2015), _slr("slr2", 2020, ptype="sms")]
        refs_by_slr = {"slr1": [_ref("p1")], "slr2": [_ref("p1"), _ref("p2")]}
        top_cited = [
            _top_cited("p1", 2010, 100, 1),
            _top_cited("p2", 2018, 200, 2),
        ]
        overlap_rows, _ = co.compute(corpus, refs_by_slr, top_cited)
        coverage = {r["slr_id"]: r["coverage_pct"] for r in overlap_rows}
        assert coverage["slr1"] == 100.0  # p1 only eligible, cited
        assert coverage["slr2"] == 100.0  # both eligible, both cited


class TestRun:
    def test_excludes_slrs_with_no_references(self, tmp_path: Path):
        corpus_path = tmp_path / "corpus.json"
        refs_path = tmp_path / "refs.json"
        top_path = tmp_path / "top.json"
        overlap_path = tmp_path / "overlap.csv"
        missed_path = tmp_path / "missed.csv"

        corpus_path.write_text(json.dumps([_slr("with_refs", 2018), _slr("no_refs", 2019)]))
        refs_path.write_text(json.dumps({"with_refs": [_ref("p1")], "no_refs": []}))
        top_path.write_text(json.dumps([_top_cited("p1", 2010, 100, 1)]))

        co.run(corpus_path, refs_path, top_path, overlap_path, missed_path)

        with overlap_path.open() as f:
            overlap = list(csv.DictReader(f))
        assert len(overlap) == 1
        assert overlap[0]["slr_id"] == "with_refs"

    def test_writes_both_csvs(self, tmp_path: Path):
        corpus_path = tmp_path / "corpus.json"
        refs_path = tmp_path / "refs.json"
        top_path = tmp_path / "top.json"
        overlap_path = tmp_path / "overlap.csv"
        missed_path = tmp_path / "missed.csv"

        corpus_path.write_text(json.dumps([_slr("slr1", 2018)]))
        refs_path.write_text(json.dumps({"slr1": [_ref("p1")]}))
        top_path.write_text(json.dumps([
            _top_cited("p1", 2010, 100, 1),
            _top_cited("p2", 2012, 80, 2),
        ]))

        co.run(corpus_path, refs_path, top_path, overlap_path, missed_path)

        with overlap_path.open() as f:
            overlap = list(csv.DictReader(f))
        with missed_path.open() as f:
            missed = list(csv.DictReader(f))

        assert len(overlap) == 1
        assert overlap[0]["coverage_pct"] == "50.0"
        assert len(missed) == 1
        assert missed[0]["missed_paper_key"] == "p2"
