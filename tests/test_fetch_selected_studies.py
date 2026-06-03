"""Tests for 02_extract_refs/fetch_selected_studies.py (Crossref refs)."""
from __future__ import annotations

import csv
import importlib.util
import json
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
MODULE_PATH = REPO_ROOT / "02_extract_refs" / "fetch_selected_studies.py"

# Numbered-stage directories are not importable as packages; load by path.
_spec = importlib.util.spec_from_file_location("fetch_selected_studies", MODULE_PATH)
fss = importlib.util.module_from_spec(_spec)
sys.modules["fetch_selected_studies"] = fss
_spec.loader.exec_module(fss)


# ---------- pure mapping ----------


def test_normalize_reference_full_record():
    ref = {
        "key": "10.1016/x_b2",
        "DOI": "10.1016/j.infsof.2015.10.008",
        "article-title": "Identification and management of technical debt",
        "author": "Alves",
        "year": "2016",
        "journal-title": "Inf. Softw. Technol.",
    }
    out = fss.normalize_reference(ref, idx=2)
    assert out == {
        "id": "R02",
        "title": "Identification and management of technical debt",
        "authors": "Alves",
        "year": "2016",
        "venue": "Inf. Softw. Technol.",
        "doi": "10.1016/j.infsof.2015.10.008",
    }


def test_normalize_reference_missing_doi_and_venue_uses_fallback_keys():
    ref = {
        "key": "x_b1",
        "article-title": "A systematic literature review of technical debt prioritization",
        "series-title": "International Conference on Technical Debt 2020",
        "author": "Alfayez",
        "year": "2020",
    }
    out = fss.normalize_reference(ref, idx=1)
    assert out["id"] == "R01"
    assert out["doi"] == ""
    assert out["venue"] == "International Conference on Technical Debt 2020"


def test_normalize_reference_empty_record():
    out = fss.normalize_reference({}, idx=99)
    assert out == {
        "id": "R99",
        "title": "",
        "authors": "",
        "year": "",
        "venue": "",
        "doi": "",
    }


def test_normalize_reference_normalizes_doi_case():
    ref = {"DOI": "10.1109/EXAMPLE.2018.0001", "article-title": "X"}
    out = fss.normalize_reference(ref, idx=1)
    assert out["doi"] == "10.1109/example.2018.0001"


# ---------- IO + idempotence ----------


def _fake_message() -> dict:
    return {
        "reference": [
            {
                "key": "10.x_b1",
                "article-title": "Paper One",
                "author": "Smith",
                "year": "2019",
                "journal-title": "Journal A",
            },
            {
                "key": "10.x_b2",
                "DOI": "10.1234/xyz.2020.001",
                "article-title": "Paper Two",
                "author": "Doe",
                "year": "2020",
                "journal-title": "Journal B",
            },
        ]
    }


def test_fetch_and_write_creates_csv_and_cache(tmp_path, monkeypatch):
    monkeypatch.setattr(fss, "fetch_crossref_work", lambda doi, mailto=None: _fake_message())

    result = fss.fetch_and_write(
        doi="10.1016/j.test.2021.000001",
        slug="paper-test-2021",
        raw_cache_dir=tmp_path / "raw",
        manual_dir=tmp_path / "manual",
    )

    assert result["n_refs"] == 2
    assert result["n_with_doi"] == 1
    assert result["skipped"] is False

    csv_path = tmp_path / "manual" / "paper-test-2021" / "references.csv"
    raw_path = tmp_path / "raw" / "paper-test-2021.json"
    assert csv_path.exists()
    assert raw_path.exists()

    with csv_path.open() as f:
        rows = list(csv.DictReader(f))
    assert [r["id"] for r in rows] == ["R01", "R02"]
    assert rows[0]["authors"] == "Smith"
    assert rows[1]["doi"] == "10.1234/xyz.2020.001"

    cached = json.loads(raw_path.read_text())
    assert cached == _fake_message()


def test_fetch_and_write_idempotent_skip(tmp_path, monkeypatch):
    calls = {"n": 0}

    def fake(doi, mailto=None):
        calls["n"] += 1
        return _fake_message()

    monkeypatch.setattr(fss, "fetch_crossref_work", fake)

    common = {
        "doi": "10.1/y",
        "slug": "y",
        "raw_cache_dir": tmp_path / "raw",
        "manual_dir": tmp_path / "manual",
    }
    fss.fetch_and_write(**common)
    assert calls["n"] == 1

    result = fss.fetch_and_write(**common)
    assert result["skipped"] is True
    assert calls["n"] == 1, "Second call must NOT hit Crossref"


def test_fetch_and_write_refresh_bypasses_cache(tmp_path, monkeypatch):
    calls = {"n": 0}

    def fake(doi, mailto=None):
        calls["n"] += 1
        return _fake_message()

    monkeypatch.setattr(fss, "fetch_crossref_work", fake)

    common = {
        "doi": "10.1/z",
        "slug": "z",
        "raw_cache_dir": tmp_path / "raw",
        "manual_dir": tmp_path / "manual",
    }
    fss.fetch_and_write(**common)
    fss.fetch_and_write(**common, refresh=True)
    assert calls["n"] == 2


def test_fetch_and_write_empty_reference_list(tmp_path, monkeypatch):
    monkeypatch.setattr(fss, "fetch_crossref_work", lambda doi, mailto=None: {"reference": []})

    result = fss.fetch_and_write(
        doi="10.1/empty",
        slug="empty-paper",
        raw_cache_dir=tmp_path / "raw",
        manual_dir=tmp_path / "manual",
    )

    assert result["n_refs"] == 0
    csv_path = tmp_path / "manual" / "empty-paper" / "references.csv"
    assert csv_path.exists()
    with csv_path.open() as f:
        rows = list(csv.DictReader(f))
    assert rows == []


# ---------- CLI ----------


def test_cli_runs_and_writes(tmp_path, monkeypatch):
    monkeypatch.setattr(fss, "fetch_crossref_work", lambda doi, mailto=None: _fake_message())
    monkeypatch.setattr(fss, "RAW_CACHE_DIR", tmp_path / "raw")
    monkeypatch.setattr(fss, "MANUAL_DIR", tmp_path / "manual")

    rc = fss.main(["--doi", "10.1/cli", "--slug", "cli-test"])
    assert rc == 0
    assert (tmp_path / "manual" / "cli-test" / "references.csv").exists()


# ---------- appendix mode ----------


def test_fetch_and_write_appendix_uses_cached_page(tmp_path, monkeypatch):
    """Adapter path should NOT hit Playwright when a cache exists."""
    slug = "fake-2024"
    cache_dir = tmp_path / "scrape"
    manual_dir = tmp_path / "manual"
    (cache_dir / slug).mkdir(parents=True)
    (cache_dir / slug / "page.md").write_text(
        "## Appendix B. The selected papers (Ps)\n\n"
        "- \\[SP1\\]\n"
        "A. Smith. Foo. J. Sys. Softw., 2019.\n",
        encoding="utf-8",
    )

    # Sentinel to detect accidental Playwright call.
    def _boom(*_args, **_kwargs):  # pragma: no cover -- must not be reached
        raise AssertionError("Playwright should not be invoked when cache exists")

    monkeypatch.setattr("lib.page_fetcher.fetch_page_markdown", lambda url, cache_path, refresh=False: (
        cache_path.read_text(encoding="utf-8") if cache_path.exists() else _boom()
    ))

    result = fss.fetch_and_write_appendix(
        url="https://www.sciencedirect.com/science/article/pii/SXXX",
        slug=slug,
        scrape_cache_dir=cache_dir,
        manual_dir=manual_dir,
    )

    assert result["n_studies"] == 1
    assert result["adapter"] == "www.sciencedirect.com"
    csv_path = manual_dir / slug / "appendix_b.csv"
    assert csv_path.exists()
    with csv_path.open() as f:
        rows = list(csv.DictReader(f))
    assert rows[0]["id"] == "SP1"
    assert rows[0]["year"] == "2019"


def test_fetch_and_write_appendix_no_adapter_returns_error(tmp_path):
    result = fss.fetch_and_write_appendix(
        url="https://unknown-publisher.example/article/123",
        slug="x",
        scrape_cache_dir=tmp_path / "scrape",
        manual_dir=tmp_path / "manual",
    )
    assert result["error"] == "no-adapter"
    assert result["n_studies"] == 0
    assert not (tmp_path / "manual" / "x" / "appendix_b.csv").exists()


def test_cli_requires_url_for_appendix_mode():
    with pytest.raises(SystemExit):
        fss._parse_args(["--mode", "appendix", "--slug", "x"])


def test_cli_requires_doi_for_refs_mode():
    with pytest.raises(SystemExit):
        fss._parse_args(["--mode", "refs", "--slug", "x"])
