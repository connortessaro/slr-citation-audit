"""Helpers for SLR reference lists and corpus filtering."""

from __future__ import annotations

from core.paperid import paper_key


def ref_keys(refs: list[dict]) -> set[str]:
    keys: set[str] = set()
    for ref in refs:
        key = ref.get("paper_key") or paper_key(ref)
        if key:
            keys.add(key)
    return keys


def has_references(refs: list[dict]) -> bool:
    return bool(ref_keys(refs))


def filter_corpus_with_refs(
    corpus: list[dict],
    refs_by_slr: dict[str, list[dict]],
) -> tuple[list[dict], list[dict]]:
    """Return (included SLRs, excluded SLRs with empty reference lists)."""
    included: list[dict] = []
    excluded: list[dict] = []
    for slr in corpus:
        slr_key = slr.get("_paper_key") or paper_key(slr)
        refs = refs_by_slr.get(slr_key, [])
        if has_references(refs):
            included.append(slr)
        else:
            excluded.append(slr)
    return included, excluded
