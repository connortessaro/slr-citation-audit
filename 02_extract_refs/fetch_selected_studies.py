"""Fetch reference bibliography for a single SLR via Crossref.

Replaces the per-publisher HTML scrape with the Crossref Works API for the
references portion of the SLR. No quota, no auth (polite-pool email only).

Out of scope here: Appendix B / Selected Primary Studies -- Crossref does not
tag which references are primary studies vs background citations. That path
still uses a publisher HTML adapter (Phase 2, separate file).

Usage:
    python 02_extract_refs/fetch_selected_studies.py \\
        --doi 10.1016/j.jss.2020.110827 \\
        --slug lenarduzzi-td-prioritization-2021

Outputs (idempotent unless --refresh):
    data/raw/crossref/<slug>.json    -- raw Crossref response
    data/manual/<slug>/references.csv -- normalized rows

Schema:
    id,title,authors,year,venue,doi

Caveat: Crossref returns the first author's surname only (string), not a full
list. Multi-author enrichment via OpenAlex is deferred to Phase 3.
"""
from __future__ import annotations

import argparse
import csv
import json
import logging
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lib.config import REPO_ROOT  # noqa: E402
from lib.paperid import normalize_doi  # noqa: E402
from lib.scrape_adapters import pick_adapter  # noqa: E402

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

CROSSREF_BASE = "https://api.crossref.org/works"
DEFAULT_MAILTO = "tessaro.c@northeastern.edu"
RAW_CACHE_DIR = REPO_ROOT / "data" / "raw" / "crossref"
SCRAPE_CACHE_DIR = REPO_ROOT / "data" / "raw" / "scrape"
MANUAL_DIR = REPO_ROOT / "data" / "manual"
CSV_FIELDS = ("id", "title", "authors", "year", "venue", "doi")


def _user_agent(mailto: str) -> str:
    return f"slr-citation-audit/0.1 (mailto:{mailto})"


def fetch_crossref_work(doi: str, mailto: str = DEFAULT_MAILTO) -> dict:
    """Return the raw `message` block from Crossref for a DOI."""
    url = f"{CROSSREF_BASE}/{urllib.parse.quote(doi, safe='/.')}"
    req = urllib.request.Request(url, headers={"User-Agent": _user_agent(mailto)})
    with urllib.request.urlopen(req, timeout=30) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    return payload.get("message") or {}


def _venue(ref: dict) -> str:
    for key in ("journal-title", "series-title", "event-title", "volume-title"):
        v = ref.get(key)
        if v:
            return v
    return ""


def _authors(ref: dict) -> str:
    """Crossref ref records carry a single string `author` = first surname.

    Falls back to empty string when missing. Phase 3 enrichment will resolve
    full author lists for refs that have a DOI.
    """
    a = ref.get("author")
    if isinstance(a, str):
        return a.strip()
    return ""


def normalize_reference(ref: dict, idx: int) -> dict:
    """Map one Crossref reference entry into the project CSV schema."""
    return {
        "id": f"R{idx:02d}",
        "title": (ref.get("article-title") or "").strip(),
        "authors": _authors(ref),
        "year": (ref.get("year") or "").strip(),
        "venue": _venue(ref).strip(),
        "doi": normalize_doi(ref.get("DOI")) or "",
    }


def write_csv(rows: list[dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(rows)


def fetch_and_write(
    doi: str,
    slug: str,
    *,
    refresh: bool = False,
    mailto: str = DEFAULT_MAILTO,
    raw_cache_dir: Path | None = None,
    manual_dir: Path | None = None,
) -> dict:
    """Pull refs for one DOI -> write raw cache + CSV. Returns summary dict."""
    raw_cache_dir = raw_cache_dir if raw_cache_dir is not None else RAW_CACHE_DIR
    manual_dir = manual_dir if manual_dir is not None else MANUAL_DIR
    raw_path = raw_cache_dir / f"{slug}.json"
    csv_path = manual_dir / slug / "references.csv"

    if csv_path.exists() and not refresh:
        logger.info("Skip %s: %s exists (use --refresh to overwrite)", slug, csv_path)
        return {"slug": slug, "skipped": True, "csv_path": str(csv_path)}

    if raw_path.exists() and not refresh:
        logger.info("Reusing cached Crossref payload at %s", raw_path)
        message = json.loads(raw_path.read_text(encoding="utf-8"))
    else:
        logger.info("Fetching Crossref work for DOI %s", doi)
        message = fetch_crossref_work(doi, mailto=mailto)
        raw_cache_dir.mkdir(parents=True, exist_ok=True)
        raw_path.write_text(json.dumps(message, indent=2, sort_keys=True), encoding="utf-8")

    refs = message.get("reference") or []
    rows = [normalize_reference(r, i + 1) for i, r in enumerate(refs)]
    write_csv(rows, csv_path)

    n_with_doi = sum(1 for r in rows if r["doi"])
    logger.info("Wrote %d refs (%d w/ DOI) to %s", len(rows), n_with_doi, csv_path)

    return {
        "slug": slug,
        "skipped": False,
        "csv_path": str(csv_path),
        "raw_path": str(raw_path),
        "n_refs": len(rows),
        "n_with_doi": n_with_doi,
    }


def fetch_and_write_appendix(
    url: str,
    slug: str,
    *,
    refresh: bool = False,
    scrape_cache_dir: Path | None = None,
    manual_dir: Path | None = None,
) -> dict:
    """Pull Appendix-B (selected primary studies) for one SLR landing-page URL.

    Picks an adapter by URL host, fetches the page via Playwright (cached),
    parses the appendix block, and writes data/manual/<slug>/appendix_b.csv.
    Returns a summary dict.

    Adapter dispatch failure (unknown publisher) -> summary dict with
    `error: "no-adapter"` and zero rows written. Caller decides to escalate.
    """
    from lib.page_fetcher import fetch_page_markdown  # lazy: avoids playwright import in test path

    scrape_cache_dir = scrape_cache_dir if scrape_cache_dir is not None else SCRAPE_CACHE_DIR
    manual_dir = manual_dir if manual_dir is not None else MANUAL_DIR

    adapter = pick_adapter(url)
    if adapter is None:
        logger.error("No scrape adapter registered for URL %s", url)
        return {"slug": slug, "skipped": False, "error": "no-adapter", "n_studies": 0}

    csv_path = manual_dir / slug / "appendix_b.csv"
    if csv_path.exists() and not refresh:
        logger.info("Skip %s: %s exists (use --refresh to overwrite)", slug, csv_path)
        return {"slug": slug, "skipped": True, "csv_path": str(csv_path)}

    cache_path = scrape_cache_dir / slug / "page.md"
    page_md = fetch_page_markdown(url, cache_path=cache_path, refresh=refresh)
    studies = adapter.parse_appendix(page_md)
    rows = [s.as_row() for s in studies]
    write_csv(rows, csv_path)

    logger.info("Wrote %d primary studies to %s", len(rows), csv_path)
    return {
        "slug": slug,
        "skipped": False,
        "csv_path": str(csv_path),
        "cache_path": str(cache_path),
        "n_studies": len(rows),
        "adapter": adapter.host,
    }


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n", 1)[0])
    parser.add_argument(
        "--mode",
        choices=("refs", "appendix", "both"),
        default="refs",
        help="What to pull (default: refs only)",
    )
    parser.add_argument("--doi", help="SLR DOI (required for refs mode)")
    parser.add_argument("--url", help="SLR landing-page URL (required for appendix mode)")
    parser.add_argument("--slug", required=True, help="Output slug (kebab-case)")
    parser.add_argument("--refresh", action="store_true", help="Re-fetch + overwrite")
    parser.add_argument("--mailto", default=DEFAULT_MAILTO, help="Crossref polite-pool email")
    args = parser.parse_args(argv)

    if args.mode in ("refs", "both") and not args.doi:
        parser.error("--doi is required for mode=refs and mode=both")
    if args.mode in ("appendix", "both") and not args.url:
        parser.error("--url is required for mode=appendix and mode=both")
    return args


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    rc = 0

    if args.mode in ("refs", "both"):
        try:
            fetch_and_write(
                doi=args.doi,
                slug=args.slug,
                refresh=args.refresh,
                mailto=args.mailto,
            )
        except urllib.error.HTTPError as exc:
            logger.error("Crossref HTTP %s for DOI %s: %s", exc.code, args.doi, exc.reason)
            rc = 2
        except urllib.error.URLError as exc:
            logger.error("Network error fetching DOI %s: %s", args.doi, exc.reason)
            rc = 3

    if args.mode in ("appendix", "both") and rc == 0:
        try:
            result = fetch_and_write_appendix(
                url=args.url,
                slug=args.slug,
                refresh=args.refresh,
            )
        except Exception as exc:
            logger.error("Appendix scrape failed for %s: %s", args.url, exc)
            rc = 4
        else:
            if result.get("error") == "no-adapter":
                rc = 5

    return rc


if __name__ == "__main__":
    raise SystemExit(main())
