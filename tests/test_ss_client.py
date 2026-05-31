"""Tests for core.ss_client.SSClient."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from core import ss_client as sc  # noqa: E402


class _FakeSearchResults:
    """Yields a fixed number of paper dicts (simulates PaginatedResults iteration)."""

    def __init__(self, n: int) -> None:
        self._n = n

    def __iter__(self):
        for i in range(self._n):
            yield {"paperId": f"p{i}"}


@pytest.fixture
def isolated_cache(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(sc, "CACHE_DIR", tmp_path)
    return tmp_path


def test_search_papers_passes_capped_page_limit(isolated_cache: Path):
    seen_limits: list[int] = []

    def fake_search_paper(query, year=None, limit=100, fields=None):
        seen_limits.append(limit)
        return _FakeSearchResults(500)

    client = sc.SSClient()
    client._client = type("C", (), {"search_paper": staticmethod(fake_search_paper)})()
    client._call = lambda fn, *a, **kw: fn(*a, **kw)  # noqa: SLF001

    papers = client.search_papers("technical debt", limit=250)
    assert len(papers) == 250
    assert seen_limits == [100]

    papers = client.search_papers("technical debt", limit=50)
    assert len(papers) == 50
    assert seen_limits[-1] == 50


def test_search_papers_caps_at_1000(isolated_cache: Path):
    def fake_search_paper(query, year=None, limit=100, fields=None):
        return _FakeSearchResults(1500)

    client = sc.SSClient()
    client._client = type("C", (), {"search_paper": staticmethod(fake_search_paper)})()
    client._call = lambda fn, *a, **kw: fn(*a, **kw)  # noqa: SLF001

    papers = client.search_papers("technical debt", limit=5000)
    assert len(papers) == 1000
