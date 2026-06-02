"""Shared pytest fixtures."""
from __future__ import annotations

import json
from pathlib import Path

import pytest


@pytest.fixture
def sample_paper() -> dict:
    return {
        "paperId": "abc123",
        "title": "A Systematic Literature Review of Technical Debt",
        "year": 2018,
        "doi": "10.1109/EXAMPLE.2018.0001",
        "externalIds": {"DOI": "10.1109/EXAMPLE.2018.0001"},
        "citationCount": 412,
        "venue": "Empirical Software Engineering",
        "openAccessPdf": {"url": "https://example.org/paper.pdf"},
    }


@pytest.fixture
def sample_papers(sample_paper: dict) -> list[dict]:
    second = dict(sample_paper)
    second["paperId"] = "def456"
    second["title"] = "Managing Technical Debt: A Systematic Mapping"
    second["doi"] = "10.1145/EXAMPLE.2020.0002"
    second["year"] = 2020
    return [sample_paper, second]


@pytest.fixture(autouse=True)
def isolated_cache(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Redirect SS cache writes to a temp dir per test."""
    from core import ss_client

    cache = tmp_path / "ss_cache"
    cache.mkdir()
    monkeypatch.setattr(ss_client, "CACHE_DIR", cache)
    return cache


def write_fixture(path: Path, payload: dict) -> Path:
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path
