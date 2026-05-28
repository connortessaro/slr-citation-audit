"""Tests for Semantic Scholar search planning (no live API)."""
from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

_REPO = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location(
    "search_semantic_scholar",
    _REPO / "01_identify_slrs" / "search_semantic_scholar.py",
)
_ss = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(_ss)


def test_planned_searches_order_and_count():
    keywords = ["technical debt", "code debt"]
    patterns = ["systematic review", "systematic mapping"]
    plan = _ss.planned_searches(keywords, patterns)
    assert len(plan) == 6  # 2*2 targeted + 2 broad
    assert plan[0] == ("targeted", "technical debt systematic review")
    assert plan[-1] == ("broad", "code debt")


def test_iter_searches_respects_cap():
    keywords = ["a", "b"]
    patterns = ["p"]
    capped = list(_ss._iter_searches(keywords, patterns, max_searches=2))
    assert len(capped) == 2
    assert capped[0][0] == "targeted"
    assert capped[1][0] == "targeted"


def test_iter_searches_unlimited():
    keywords = ["a"]
    patterns = ["p"]
    assert len(list(_ss._iter_searches(keywords, patterns, max_searches=None))) == 2


def test_append_dedup_via_dedup_by_key():
    from lib.paperid import dedup_by_key

    existing = [{"title": "SLR A", "paperId": "1", "year": 2010}]
    fetched = [
        {"title": "SLR A duplicate", "paperId": "1", "year": 2010},
        {"title": "SLR B", "paperId": "2", "year": 2005},
    ]
    merged = dedup_by_key(existing + fetched)
    assert len(merged) == 2
