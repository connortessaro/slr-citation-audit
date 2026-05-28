"""Search IEEE Xplore for SLR candidates.

Two paths:
    1. If $IEEE_XPLORE_API_KEY is set, use the IEEE Xplore Metadata Search API.
    2. Otherwise, parse manual BibTeX exports from `data/raw/ieee_exports/`
       (mirror of the ACM workflow).

Output: data/raw/ieee_slr_candidates.json
"""
from __future__ import annotations

import json
import logging
import os
import re
from pathlib import Path
from typing import Iterable

import bibtexparser
import requests
from ratelimit import limits, sleep_and_retry

from lib.config import REPO_ROOT, load as load_config
from lib.paperid import dedup_by_key
from lib.paths import candidates_output_path, exports_dir

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

IEEE_EXPORTS_DIR = exports_dir("ieee")
OUTPUT_PATH = candidates_output_path("ieee")
IEEE_API_URL = "https://ieeexploreapi.ieee.org/api/v1/search/articles"

_YEAR_PATTERN = re.compile(r"\b(19|20)\d{2}\b")


@sleep_and_retry
@limits(calls=200, period=86400)  # IEEE free tier: 200 calls/day
def _ieee_api_get(params: dict) -> dict:
    response = requests.get(IEEE_API_URL, params=params, timeout=30)
    response.raise_for_status()
    return response.json()


def _api_article_to_paper(article: dict) -> dict:
    return {
        "paperId": None,
        "title": article.get("title"),
        "abstract": article.get("abstract"),
        "year": int(article["publication_year"]) if article.get("publication_year") else None,
        "venue": article.get("publication_title"),
        "externalIds": {"DOI": article.get("doi")} if article.get("doi") else {},
        "doi": article.get("doi"),
        "authors": article.get("authors"),
        "source": "ieee",
    }


def _bibtex_to_paper(entry: dict) -> dict:
    year_match = _YEAR_PATTERN.search(entry.get("year", "") or "")
    return {
        "paperId": None,
        "title": (entry.get("title") or "").strip().strip("{}"),
        "abstract": entry.get("abstract"),
        "year": int(year_match.group(0)) if year_match else None,
        "venue": entry.get("booktitle") or entry.get("journal"),
        "externalIds": {"DOI": entry.get("doi")} if entry.get("doi") else {},
        "doi": entry.get("doi"),
        "authors": entry.get("author"),
        "source": "ieee",
        "raw_bibtex_key": entry.get("ID"),
    }


def _search_via_api(api_key: str, keywords: Iterable[str], year_min: int, year_max: int) -> list[dict]:
    out: list[dict] = []
    for keyword in keywords:
        query = f'("{keyword}") AND ("systematic literature review" OR "systematic mapping")'
        params = {
            "apikey": api_key,
            "querytext": query,
            "start_year": year_min,
            "end_year": year_max,
            "max_records": 200,
            "sort_field": "article_number",
            "sort_order": "asc",
        }
        logger.info("IEEE API search: %r", query)
        payload = _ieee_api_get(params)
        out.extend(_api_article_to_paper(a) for a in payload.get("articles", []))
    return out


def _search_via_exports(keywords: Iterable[str]) -> list[dict]:
    IEEE_EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
    bibs = sorted(IEEE_EXPORTS_DIR.glob("*.bib"))
    if not bibs:
        logger.warning("No .bib exports in %s and no IEEE_XPLORE_API_KEY set", IEEE_EXPORTS_DIR)
        return []
    out: list[dict] = []
    for path in bibs:
        logger.info("Parsing %s", path)
        with path.open("r", encoding="utf-8") as f:
            db = bibtexparser.load(f)
        out.extend(_bibtex_to_paper(e) for e in db.entries)
    keyword_lower = [k.lower() for k in keywords]
    return [
        p for p in out
        if any(k in ((p.get("title") or "") + " " + (p.get("abstract") or "")).lower() for k in keyword_lower)
    ]


def run() -> list[dict]:
    cfg = load_config()
    api_key = os.environ.get("IEEE_XPLORE_API_KEY")
    if api_key:
        raw = _search_via_api(api_key, cfg.keywords, cfg.year_min, cfg.year_max)
    else:
        raw = _search_via_exports(cfg.keywords)
    unique = dedup_by_key(raw)
    logger.info("IEEE: %d raw, %d unique", len(raw), len(unique))

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(unique, indent=2, sort_keys=True), encoding="utf-8")
    return unique


def main() -> None:
    papers = run()
    print(f"Wrote {len(papers)} IEEE candidates to {OUTPUT_PATH.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
