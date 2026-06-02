"""Paper identifier normalisation and dedup helpers."""
from __future__ import annotations

import re
import unicodedata

_DOI_PREFIX_PATTERN = re.compile(r"^(?:https?://(?:dx\.)?doi\.org/|doi:)", re.IGNORECASE)
_NON_ALNUM = re.compile(r"[^a-z0-9]+")
_KEY_FS_SAFE = re.compile(r"[^a-zA-Z0-9._-]+")


def safe_filename(key: str, max_len: int = 200) -> str:
    """Filesystem-safe slug for a paper_key. Used by cache layers under data/raw/."""
    return _KEY_FS_SAFE.sub("_", key)[:max_len]


def normalize_doi(doi: str | None) -> str | None:
    """Return canonical lowercase DOI without URL/scheme prefix, or None."""
    if not doi:
        return None
    doi = doi.strip()
    doi = _DOI_PREFIX_PATTERN.sub("", doi)
    return doi.lower() or None


def normalize_title(title: str | None) -> str:
    """Return a comparison-safe title: lowercased, ASCII-folded, alnum-only."""
    if not title:
        return ""
    folded = unicodedata.normalize("NFKD", title)
    folded = folded.encode("ascii", "ignore").decode("ascii")
    return _NON_ALNUM.sub("", folded.lower())


def paper_key(paper: dict) -> str:
    """Return a stable dedup key for a paper dict.

    Priority: normalized DOI > Semantic Scholar paperId > normalized title.
    """
    ext = paper.get("externalIds") or {}
    doi = normalize_doi(paper.get("doi") or ext.get("DOI"))
    if doi:
        return f"doi:{doi}"
    pid = paper.get("paperId") or paper.get("id")
    if pid:
        return f"ss:{pid}"
    return f"title:{normalize_title(paper.get('title'))}"


def dedup_by_key(papers: list[dict]) -> list[dict]:
    seen: set[str] = set()
    out: list[dict] = []
    for p in papers:
        k = paper_key(p)
        if k in seen:
            continue
        seen.add(k)
        out.append(p)
    return out
