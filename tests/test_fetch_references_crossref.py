"""Tests for Crossref reference normalisation (no live API)."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

_REPO = Path(__file__).resolve().parent.parent
_EXTRACT = _REPO / "02_extract_refs"
sys.path.insert(0, str(_EXTRACT))

import fetch_references_crossref as cr  # noqa: E402


class TestCrossrefNormalise:
    def test_maps_doi_and_title(self):
        raw = [
            {
                "DOI": "10.1016/j.infsof.2015.10.008",
                "article-title": "Identification and management of technical debt",
                "year": "2016",
                "journal-title": "Inf. Software Technol.",
            }
        ]
        out = cr.normalise_crossref_references(raw)
        assert len(out) == 1
        assert out[0]["paper_key"] == "doi:10.1016/j.infsof.2015.10.008"
        assert out[0]["doi"] == "10.1016/j.infsof.2015.10.008"
        assert out[0]["year"] == 2016
        assert out[0]["paperId"] is None

    def test_skips_entries_without_title(self):
        assert cr.normalise_crossref_references([{"year": "2020"}]) == []
