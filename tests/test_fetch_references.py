import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "02_extract_refs"))
import fetch_references as fr  # noqa: E402


def _slr(**overrides) -> dict:
    base = {
        "title": "SLR Of Technical Debt",
        "year": 2018,
        "doi": "10.1109/X.2018.1",
        "paperId": "ssA",
        "_paper_key": "doi:10.1109/x.2018.1",
    }
    base.update(overrides)
    return base


def _ref(paper_id: str, title: str, year: int, doi: str | None = None) -> dict:
    return {
        "citedPaper": {
            "paperId": paper_id,
            "title": title,
            "year": year,
            "doi": doi,
            "externalIds": {"DOI": doi} if doi else {},
        }
    }


class StubClient:
    def __init__(self, payload_by_id: dict[str, list[dict]]):
        self._payload = payload_by_id
        self.calls: list[str] = []

    def get_references(self, paper_id: str, fields=None):
        self.calls.append(paper_id)
        return self._payload.get(paper_id, [])


class TestResolvePaperId:
    def test_uses_paper_id_when_present(self):
        assert fr._resolve_paper_id({"paperId": "abc"}) == "abc"

    def test_falls_back_to_doi(self):
        assert fr._resolve_paper_id({"doi": "10.1/X"}) == "DOI:10.1/x"

    def test_returns_none_when_no_id(self):
        assert fr._resolve_paper_id({"title": "X"}) is None


class TestNormaliseReference:
    def test_extracts_cited_paper_fields(self):
        out = fr._normalise_reference(_ref("p1", "A Paper", 2010, "10.1/A"))
        assert out["paper_key"] == "doi:10.1/a"
        assert out["title"] == "A Paper"
        assert out["year"] == 2010
        assert out["doi"] == "10.1/a"

    def test_handles_missing_cited_paper(self):
        assert fr._normalise_reference({}) is None
        assert fr._normalise_reference({"citedPaper": None}) is None


class TestEndToEnd:
    def test_run_caches_per_slr_and_merges(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        corpus_path = tmp_path / "corpus.json"
        output_path = tmp_path / "refs.json"
        cache_dir = tmp_path / "refs_cache"

        corpus_path.write_text(json.dumps([_slr(paperId="A"), _slr(paperId="B", _paper_key="doi:10.1/y", doi="10.1/Y")]))
        monkeypatch.setattr(fr, "REFS_CACHE_DIR", cache_dir)

        stub = StubClient({
            "A": [_ref("p1", "Ref One", 2008, "10.1/r1")],
            "B": [_ref("p2", "Ref Two", 2012, "10.1/r2"), _ref("p3", "Ref Three", 2015)],
        })
        monkeypatch.setattr(fr.SSClient, "from_config", classmethod(lambda cls: stub))

        merged = fr.run(corpus_path=corpus_path, output_path=output_path)

        assert set(merged.keys()) == {"doi:10.1109/x.2018.1", "doi:10.1/y"}
        assert len(merged["doi:10.1109/x.2018.1"]) == 1
        assert len(merged["doi:10.1/y"]) == 2
        assert stub.calls == ["A", "B"]

        # Per-SLR cache written
        assert any(cache_dir.glob("*.json"))

        # Second run should use cache, no new API calls
        stub.calls.clear()
        merged2 = fr.run(corpus_path=corpus_path, output_path=output_path)
        assert merged2 == merged
        assert stub.calls == []

    def test_run_skips_slrs_without_id(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        corpus_path = tmp_path / "corpus.json"
        output_path = tmp_path / "refs.json"
        cache_dir = tmp_path / "refs_cache"
        corpus_path.write_text(json.dumps([{"title": "No ID", "_paper_key": "title:noid"}]))
        monkeypatch.setattr(fr, "REFS_CACHE_DIR", cache_dir)
        monkeypatch.setattr(fr.SSClient, "from_config", classmethod(lambda cls: StubClient({})))

        merged = fr.run(corpus_path=corpus_path, output_path=output_path)
        assert merged == {}
