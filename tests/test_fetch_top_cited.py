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
    return tmp_path


class TestSubfieldMatch:
    def test_matches_title(self):
        assert ftc._subfield_match({"title": "Refactoring Technical Debt"}, ["technical debt"])

    def test_matches_abstract(self):
        assert ftc._subfield_match({"abstract": "We discuss technical debt"}, ["technical debt"])

    def test_no_match(self):
        assert not ftc._subfield_match({"title": "Microservices", "abstract": ""}, ["technical debt"])


class TestRun:
    def test_ranks_by_citation_count_descending(self, patched_run: Path, monkeypatch: pytest.MonkeyPatch):
        client = StubClient({
            "technical debt": [
                _paper("a", "Paper A", 2010, 100, doi="10.1/a"),
                _paper("b", "Paper B", 2012, 500, doi="10.1/b"),
                _paper("c", "Paper C", 2015, 250, doi="10.1/c"),
            ],
            "design debt": [],
            "code debt": [],
            "architectural debt": [],
        })
        monkeypatch.setattr(ftc.SSClient, "from_config", classmethod(lambda cls: client))

        top = ftc.run(top_n=3, robustness_n=3)
        assert [p["paperId"] for p in top] == ["b", "c", "a"]
        assert top[0]["_rank"] == 1
        assert top[2]["_rank"] == 3

    def test_dedups_across_keywords(self, patched_run: Path, monkeypatch: pytest.MonkeyPatch):
        shared = _paper("dup", "Shared Paper", 2015, 999, doi="10.1/dup")
        client = StubClient({
            "technical debt": [shared, _paper("a", "Other Paper", 2018, 10, doi="10.1/a")],
            "design debt": [shared],
            "code debt": [],
            "architectural debt": [],
        })
        monkeypatch.setattr(ftc.SSClient, "from_config", classmethod(lambda cls: client))
        top = ftc.run(top_n=5)
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
        top = ftc.run(top_n=5)
        assert [p["paperId"] for p in top] == ["on"]

    def test_writes_top_and_robustness_files(self, patched_run: Path, monkeypatch: pytest.MonkeyPatch):
        papers = [_paper(f"p{i}", f"Paper {i}", 2015, citations=i * 10, doi=f"10.1/p{i}") for i in range(120)]
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
        assert len(top_file) == 50
        assert len(robust_file) == 100
        assert top_file[0]["citationCount"] >= top_file[-1]["citationCount"]
