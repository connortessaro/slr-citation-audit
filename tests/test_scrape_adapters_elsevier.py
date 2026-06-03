"""Tests for the ScienceDirect / Elsevier Appendix-B adapter."""
from __future__ import annotations

from pathlib import Path

from lib.scrape_adapters import pick_adapter, registered_hosts
from lib.scrape_adapters.elsevier import ElsevierAdapter

REPO_ROOT = Path(__file__).resolve().parent.parent
LENARDUZZI_CACHE = (
    REPO_ROOT
    / "data"
    / "raw"
    / "scrape"
    / "lenarduzzi-td-prioritization-2021"
    / "page.md"
)


# ---- registry / dispatch ----


def test_elsevier_registered_under_sciencedirect_host():
    assert "www.sciencedirect.com" in registered_hosts()


def test_pick_adapter_matches_sciencedirect_url():
    adapter = pick_adapter("https://www.sciencedirect.com/science/article/pii/S016412122030220X")
    assert isinstance(adapter, ElsevierAdapter)


def test_pick_adapter_returns_none_for_unknown_host():
    assert pick_adapter("https://example.com/article") is None


def test_pick_adapter_tolerates_missing_www_prefix():
    adapter = pick_adapter("https://sciencedirect.com/science/article/pii/X")
    assert isinstance(adapter, ElsevierAdapter)


def test_pick_adapter_handles_empty_url():
    assert pick_adapter("") is None
    assert pick_adapter("not a url") is None


# ---- parser ----


def test_parse_appendix_returns_empty_when_no_appendix():
    adapter = ElsevierAdapter()
    out = adapter.parse_appendix("## Introduction\n\nSome body text.\n")
    assert out == []


def test_parse_appendix_parses_synthetic_two_entries():
    md = (
        "## Appendix B. The selected papers (Ps)\n\n"
        "- \\[SP1\\]\n"
        "A. Smith, B. Jones. A study of foo. J. Sys. Softw., 2018.\n"
        "- \\[SP2\\]\n"
        "C. Lee et al. Bar revisited. ICSE, 2020.\n\n"
        "Recommended articles\n"
    )
    out = ElsevierAdapter().parse_appendix(md)
    assert len(out) == 2
    assert out[0].id == "SP1"
    assert out[0].year == "2018"
    assert "Smith" in out[0].authors
    assert out[1].id == "SP2"
    assert out[1].authors.endswith("et al.")


def test_parse_appendix_lenarduzzi_cache_matches_expected_count():
    """Live regression: the cached Lenarduzzi page must parse to 44 entries."""
    if not LENARDUZZI_CACHE.exists():
        # Cache absent (clean checkout). Skip rather than fail tests.
        import pytest

        pytest.skip(f"Lenarduzzi cache missing at {LENARDUZZI_CACHE}")

    md = LENARDUZZI_CACHE.read_text(encoding="utf-8")
    out = ElsevierAdapter().parse_appendix(md)

    assert len(out) == 44, f"expected 44 primary studies, got {len(out)}"
    assert {row.id for row in out} == {f"SP{i}" for i in range(1, 45)}
    # Every row has at least a title or authors string.
    assert all(row.title or row.authors for row in out)
    # Most rows should carry a 4-digit year.
    year_count = sum(1 for r in out if r.year)
    assert year_count >= 40
