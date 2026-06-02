import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "03_top_cited"))
import fetch_top_cited as ftc  # noqa: E402


def _paper(paper_id: str, title: str, year: int, citations: int, doi: str | None = None, abstract: str = "") -> dict:
    return {
        "paperId": paper_id,
        "title": title,
        "abstract": abstract or "Discussion of technical debt management.",
        "year": year,
        "citationCount": citations,
        "doi": doi,
        "externalIds": {"DOI": doi} if doi else {},
    }


class StubClient:
    def __init__(self, by_keyword: dict[str, list[dict]]):
        self.by_keyword = by_keyword

    def search_papers(self, query: str, year=None, limit=100, fields=None):
        return list(self.by_keyword.get(query, []))


@pytest.fixture
def patched_run(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(ftc, "OUTPUT_PATH", tmp_path / "top.json")
    monkeypatch.setattr(ftc, "ROBUSTNESS_PATH", tmp_path / "top100.json")
    monkeypatch.setattr(ftc, "META_PATH", tmp_path / "meta.json")
    return tmp_path


class TestSubfieldMatch:
    def test_matches_title(self):
        assert ftc._subfield_match({"title": "Refactoring Technical Debt"}, ["technical debt"])

    def test_matches_abstract(self):
        assert ftc._subfield_match({"abstract": "We discuss technical debt"}, ["technical debt"])

    def test_no_match(self):
        assert not ftc._subfield_match({"title": "Microservices", "abstract": ""}, ["technical debt"])


class TestSplitEstablishedRecent:
    def test_partition_by_cutoff(self):
        papers = [
            _paper("old", "Old", 2010, 10),
            _paper("edge", "Edge", 2022, 20),
            _paper("new", "New", 2023, 30),
        ]
        est, rec = ftc.split_established_recent(papers, as_of_year=2026, recent_years=4)
        assert [p["paperId"] for p in est] == ["old", "edge"]
        assert [p["paperId"] for p in rec] == ["new"]


class TestTwoPassSelect:
    def test_takes_half_from_each_pass(self):
        pool = [
            _paper("e1", "E1", 2015, 100, doi="10.1/e1"),
            _paper("e2", "E2", 2010, 50, doi="10.1/e2"),
            _paper("r1", "R1", 2023, 80, doi="10.1/r1"),
            _paper("r2", "R2", 2024, 40, doi="10.1/r2"),
        ]
        top, meta = ftc.two_pass_select(pool, top_n=4, as_of_year=2026, recent_years=4)
        assert len(top) == 4
        assert [p["paperId"] for p in top[:2]] == ["e1", "e2"]
        assert [p["paperId"] for p in top[2:]] == ["r1", "r2"]
        assert top[0]["_pass"] == "established"
        assert top[2]["_pass"] == "recent"
        assert meta["established_selected"] == 2
        assert meta["recent_selected"] == 2

    def test_global_rank_is_sequential(self):
        pool = [_paper("e1", "E1", 2015, 100, doi="10.1/e1"), _paper("r1", "R1", 2023, 80, doi="10.1/r1")]
        top, _ = ftc.two_pass_select(pool, top_n=2, as_of_year=2026, recent_years=4)
        assert [p["_rank"] for p in top] == [1, 2]


class TestRun:
    def test_two_pass_ranking(self, patched_run: Path, monkeypatch: pytest.MonkeyPatch):
        client = StubClient({
            "technical debt": [
                _paper("old_high", "Old High", 2012, 500, doi="10.1/old"),
                _paper("old_low", "Old Low", 2011, 100, doi="10.1/old2"),
                _paper("new_high", "New High", 2023, 200, doi="10.1/new"),
                _paper("new_low", "New Low", 2024, 50, doi="10.1/new2"),
            ],
            "design debt": [],
            "code debt": [],
            "architectural debt": [],
        })
        monkeypatch.setattr(ftc.SSClient, "from_config", classmethod(lambda cls: client))

        top = ftc.run(top_n=4, robustness_n=4)
        assert [p["paperId"] for p in top] == ["old_high", "old_low", "new_high", "new_low"]
        assert top[0]["_pass"] == "established"
        assert top[2]["_pass"] == "recent"

    def test_dedups_across_keywords(self, patched_run: Path, monkeypatch: pytest.MonkeyPatch):
        shared = _paper("dup", "Shared Paper", 2015, 999, doi="10.1/dup")
        client = StubClient({
            "technical debt": [shared, _paper("a", "Other Paper", 2018, 10, doi="10.1/a")],
            "design debt": [shared],
            "code debt": [],
            "architectural debt": [],
        })
        monkeypatch.setattr(ftc.SSClient, "from_config", classmethod(lambda cls: client))
        top = ftc.run(top_n=2, robustness_n=2)
        ids = [p["paperId"] for p in top]
        assert ids.count("dup") == 1
        assert ids[0] == "dup"

    def test_filters_off_subfield_papers(self, patched_run: Path, monkeypatch: pytest.MonkeyPatch):
        off_topic = _paper("off", "Microservices Survey", 2018, 5000, abstract="Microservices architecture.")
        on_topic = _paper("on", "Technical Debt in Microservices", 2018, 50, abstract="Tech debt within microservice systems.")
        client = StubClient({
            "technical debt": [off_topic, on_topic],
            "design debt": [],
            "code debt": [],
            "architectural debt": [],
        })
        monkeypatch.setattr(ftc.SSClient, "from_config", classmethod(lambda cls: client))
        top = ftc.run(top_n=5, robustness_n=5)
        assert [p["paperId"] for p in top] == ["on"]

    def test_writes_top_robustness_and_meta(self, patched_run: Path, monkeypatch: pytest.MonkeyPatch):
        papers = [
            _paper(f"e{i}", f"Est {i}", 2010 + (i % 20), citations=1000 - i, doi=f"10.1/e{i}")
            for i in range(60)
        ] + [
            _paper(f"r{i}", f"Rec {i}", 2023, citations=500 - i, doi=f"10.1/r{i}")
            for i in range(60)
        ]
        client = StubClient({
            "technical debt": papers,
            "design debt": [],
            "code debt": [],
            "architectural debt": [],
        })
        monkeypatch.setattr(ftc.SSClient, "from_config", classmethod(lambda cls: client))
        ftc.run(top_n=50, robustness_n=100)

        top_file = json.loads((patched_run / "top.json").read_text())
        robust_file = json.loads((patched_run / "top100.json").read_text())
        meta = json.loads((patched_run / "meta.json").read_text())
        assert len(top_file) == 50
        assert len(robust_file) == 100
        assert sum(1 for p in top_file if p["_pass"] == "established") == 25
        assert sum(1 for p in top_file if p["_pass"] == "recent") == 25
        assert meta["primary"]["method"] == "two_pass_citation_count"
