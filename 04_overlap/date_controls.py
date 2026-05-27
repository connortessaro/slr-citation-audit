"""Helpers for filtering the top-cited corpus by SLR publication year."""
from __future__ import annotations


def filter_by_year(top_cited: list[dict], cutoff_year: int | None) -> list[dict]:
    """Return papers with `year <= cutoff_year`.

    Used to ensure an SLR can only be 'blamed' for missing papers that existed
    when it was published. Papers with missing `year` are excluded — we cannot
    apply a date control to them, so they are treated as ineligible.

    If `cutoff_year` is None, the original list is returned unchanged.
    """
    if cutoff_year is None:
        return list(top_cited)
    out: list[dict] = []
    for paper in top_cited:
        year = paper.get("year")
        if year is None:
            continue
        try:
            if int(year) <= int(cutoff_year):
                out.append(paper)
        except (TypeError, ValueError):
            continue
    return out
