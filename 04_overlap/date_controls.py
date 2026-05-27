"""Helpers for filtering the top-cited corpus by SLR publication year."""
from __future__ import annotations


def filter_by_year(top_cited: list[dict], cutoff_year: int) -> list[dict]:
    """Return papers with pub_year <= cutoff_year. Used to ensure an SLR can
    only be 'blamed' for missing papers that existed when it was published."""
    raise NotImplementedError
