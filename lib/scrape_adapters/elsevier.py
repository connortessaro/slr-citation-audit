"""ScienceDirect / Elsevier adapter for Appendix-B selected-primary-studies.

Operates on a markdown render of the article landing page (produced by
`lib.page_fetcher`). Lifts the parsing logic from the Lenarduzzi one-off
into a reusable adapter.

Appendix recognition: looks for a heading that starts with "Appendix"
followed by a primary-study list of "- \\[SP<n>\\]" entries, which is
the ScienceDirect convention as of 2020-2024 articles.
"""
from __future__ import annotations

import re

from . import BaseAdapter, PrimaryStudy, register


# ---- Patterns (mirror /tmp/scidirect/build_csvs.py) -----------------------

_LASTNAME_TOKEN = r"[A-ZÁÉÍÓÚÑÄÖÜÅ][A-Za-zçñüáéíóúýÁÉÍÓÚÑäÄëïößÖÜÅåĀāĭıïłÀ-ÿ\-'’`]+"
_LASTNAME = rf"{_LASTNAME_TOKEN}(?:\s+{_LASTNAME_TOKEN}){{0,2}}"
_AUTHOR = rf"(?:[A-Za-z]\.\s*){{1,4}}{_LASTNAME}"
_AUTHOR_LIST = rf"{_AUTHOR}(?:\s*,\s*(?:and\s+)?{_AUTHOR})*(?:\s*,?\s+and\s+{_AUTHOR})?"

_APPENDIX_HEADING = re.compile(
    r"^##\s+Appendix\s+[A-Z]\b[^\n]*$",
    re.MULTILINE,
)

# Trailing markers that end the appendix section on ScienceDirect pages.
_APPENDIX_END_MARKERS = (
    "Recommended articles",
    "## References",
    "## Acknowledg",
    "## Funding",
)

_SP_BLOCK = re.compile(
    r"-\s*\\\[SP(\d+)\\\]\s*\n([^\n].*?)(?=\n-\s*\\\[SP|\Z)",
    re.DOTALL,
)


def _strip_leading_year(s: str) -> str:
    return re.sub(r"^\s*\b(?:19|20)\d{2}\.\s+", "", s)


def _split_authors_title(body: str) -> tuple[str, str]:
    """Match the leading author list, return (authors, rest)."""
    m = re.match(rf"^\s*({_AUTHOR}(?:\s*,\s*{_AUTHOR})*)\s+et\s+al\.\s*(.*)$", body)
    if m:
        return f"{m.group(1).strip()} et al.", _strip_leading_year(m.group(2)).strip()
    m = re.match(rf"^\s*({_AUTHOR_LIST})(?:\s*,\s*{_LASTNAME_TOKEN})?\s*\.\s*(.*)$", body)
    if m:
        return m.group(1).strip(), _strip_leading_year(m.group(2)).strip()
    m = re.match(rf"^\s*({_AUTHOR}(?:\s*,\s*{_AUTHOR})+)\s*,\s*(.*)$", body)
    if m:
        return m.group(1).strip(), _strip_leading_year(m.group(2)).strip()
    parts = re.split(r"\.\s+", body, maxsplit=1)
    if len(parts) == 2:
        return parts[0].strip(), _strip_leading_year(parts[1]).strip()
    return body.strip(), ""


def _parse_sp(raw: str) -> tuple[str, str, str, str]:
    """Return (title, authors, year, venue) for a single primary-study block."""
    text = " ".join(raw.split())
    years = re.findall(r"\b(?:19|20)\d{2}\b", text)
    year = years[-1] if years else ""
    body = re.sub(r"[\s,\.]*\b(?:19|20)\d{2}\.?\s*$", "", text).strip().rstrip(",.")

    authors, rest = _split_authors_title(body)
    if rest:
        parts = re.split(r"\.\s+", rest, maxsplit=1)
        title, venue = (parts[0], parts[1]) if len(parts) == 2 else (parts[0], "")
    else:
        title, venue = "", ""

    return (
        title.strip().rstrip(",.").strip(),
        authors,
        year,
        venue.strip().rstrip(",.").strip(),
    )


def _extract_appendix_block(page_md: str) -> str:
    """Slice the markdown between the Appendix heading and the next major section."""
    heading_match = _APPENDIX_HEADING.search(page_md)
    if not heading_match:
        return ""
    rest = page_md[heading_match.end():]
    cut = len(rest)
    for marker in _APPENDIX_END_MARKERS:
        idx = rest.find(marker)
        if idx != -1 and idx < cut:
            cut = idx
    return rest[:cut]


class ElsevierAdapter(BaseAdapter):
    host = "www.sciencedirect.com"

    def parse_appendix(self, page_md: str) -> list[PrimaryStudy]:
        block = _extract_appendix_block(page_md)
        if not block:
            return []
        out: list[PrimaryStudy] = []
        for sp_num, raw in _SP_BLOCK.findall(block):
            title, authors, year, venue = _parse_sp(raw)
            out.append(
                PrimaryStudy(
                    id=f"SP{sp_num}",
                    title=title,
                    authors=authors,
                    year=year,
                    venue=venue,
                    doi="",
                )
            )
        return out


register(ElsevierAdapter())
