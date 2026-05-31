"""Fetch SLR reference lists from Crossref when Semantic Scholar returns none.

Reads `data/manual/<source>/slrs_missing_references.csv` (or any CSV with
`doi` + `refs_cache_filename` columns), queries Crossref Works API by DOI,
normalises references into the same schema as `fetch_references.py`, and writes
per-SLR cache files under `data/raw/<source>/refs/`.

Usage:
    PYTHONPATH=. python3 02_extract_refs/fetch_references_crossref.py --source ss
    PYTHONPATH=. python3 02_extract_refs/fetch_references_crossref.py --source ss --merge
"""
from __future__ import annotations

import argparse
import csv
import json
import logging
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from tqdm import tqdm

from lib.config import REPO_ROOT, load as load_config
from lib.paperid import dedup_by_key, normalize_doi
from lib.paths import Source, SourcePaths

_EXTRACT_DIR = Path(__file__).resolve().parent
if str(_EXTRACT_DIR) not in sys.path:
    sys.path.insert(0, str(_EXTRACT_DIR))

import fetch_references as fr  # noqa: E402

_normalise_reference = fr._normalise_reference

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

_CROSSREF_BASE = "https://api.crossref.org/works"
_REQUEST_INTERVAL_S = 1.0


def _crossref_mailto() -> str | None:
    import os

    return os.environ.get("CROSSREF_MAILTO") or os.environ.get("MAILTO")


def _fetch_crossref_references(doi: str, *, mailto: str | None = None) -> list[dict]:
    """Return raw Crossref `reference` objects for a work DOI."""
    doi = normalize_doi(doi)
    if not doi:
        return []
    params: dict[str, str] = {}
    if mailto:
        params["mailto"] = mailto
    query = f"?{urllib.parse.urlencode(params)}" if params else ""
    url = f"{_CROSSREF_BASE}/{urllib.parse.quote(doi, safe='')}{query}"
    req = urllib.request.Request(url, headers={"User-Agent": "SLRCitationAudit/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    message = payload.get("message") or {}
    refs = message.get("reference")
    if not refs:
        return []
    if not isinstance(refs, list):
        logger.warning("Unexpected Crossref reference type for %s: %s", doi, type(refs).__name__)
        return []
    return refs


def _crossref_item_to_cited(item: dict) -> dict | None:
    """Map a Crossref reference entry to a cited-paper dict for _normalise_reference."""
    title = (
        item.get("article-title")
        or item.get("volume-title")
        or item.get("series-title")
        or item.get("unstructured")
    )
    if not title or not str(title).strip():
        return None

    doi = normalize_doi(item.get("DOI"))
    year_raw = item.get("year")
    year: int | None = None
    if year_raw is not None:
        try:
            year = int(str(year_raw)[:4])
        except ValueError:
            year = None

    venue = (
        item.get("journal-title")
        or item.get("short-container-title")
        or item.get("publisher")
        or ""
    )
    external_ids: dict = {}
    if doi:
        external_ids["DOI"] = doi

    return {
        "title": str(title).strip(),
        "year": year,
        "venue": venue,
        "doi": doi,
        "paperId": None,
        "externalIds": external_ids,
        "citationCount": None,
        "openAccessPdf": None,
    }


def normalise_crossref_references(raw_refs: list[dict]) -> list[dict]:
    """Convert Crossref reference rows to pipeline reference records."""
    normalised: list[dict] = []
    for raw in raw_refs:
        cited = _crossref_item_to_cited(raw)
        if not cited:
            continue
        row = _normalise_reference(cited)
        if row:
            normalised.append(row)
    return dedup_by_key(normalised)


def _cache_is_empty(path: Path) -> bool:
    if not path.exists():
        return True
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return True
    return not data


def run(
    *,
    source: Source,
    input_csv: Path,
    cache_dir: Path,
    overwrite_empty: bool = True,
    force: bool = False,
) -> dict[str, int]:
    """Fetch Crossref refs for rows in the missing-references CSV.

    Returns counts: ok, empty, skipped, failed.
    """
    if not input_csv.exists():
        raise FileNotFoundError(f"Missing input CSV: {input_csv}")

    mailto = _crossref_mailto()
    cache_dir.mkdir(parents=True, exist_ok=True)

    counts = {"ok": 0, "empty": 0, "skipped": 0, "failed": 0}
    rows_out: list[dict[str, str]] = []

    with input_csv.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = list(reader.fieldnames or [])
        for col in ("manual_refs_status", "notes"):
            if col not in fieldnames:
                fieldnames.append(col)
        rows = list(reader)

    for row in tqdm(rows, desc="crossref refs"):
        doi = row.get("doi") or ""
        cache_name = row.get("refs_cache_filename") or ""
        if not doi or not cache_name:
            row["manual_refs_status"] = row.get("manual_refs_status") or "failed"
            row["notes"] = (row.get("notes") or "") + " missing doi or cache filename"
            counts["failed"] += 1
            rows_out.append(row)
            continue

        cache_path = cache_dir / cache_name
        if cache_path.exists() and not force:
            if not overwrite_empty or not _cache_is_empty(cache_path):
                counts["skipped"] += 1
                rows_out.append(row)
                continue

        time.sleep(_REQUEST_INTERVAL_S)
        try:
            raw = _fetch_crossref_references(doi, mailto=mailto)
            refs = normalise_crossref_references(raw)
        except urllib.error.HTTPError as exc:
            logger.error("Crossref HTTP %s for %s", exc.code, doi)
            row["manual_refs_status"] = "crossref_failed"
            row["notes"] = f"http {exc.code}"
            counts["failed"] += 1
            rows_out.append(row)
            continue
        except Exception as exc:
            logger.error("Crossref failed for %s: %s", doi, exc)
            row["manual_refs_status"] = "crossref_failed"
            row["notes"] = str(exc)[:200]
            counts["failed"] += 1
            rows_out.append(row)
            continue

        cache_path.write_text(json.dumps(refs, indent=2, sort_keys=True), encoding="utf-8")
        if refs:
            row["manual_refs_status"] = "crossref_ok"
            row["notes"] = f"{len(refs)} refs from Crossref"
            counts["ok"] += 1
            logger.info("Wrote %d refs for %s -> %s", len(refs), doi, cache_name)
        else:
            row["manual_refs_status"] = "crossref_empty"
            row["notes"] = "no references in Crossref deposit"
            counts["empty"] += 1
        rows_out.append(row)

    with input_csv.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows_out)

    logger.info(
        "Crossref fetch done: %d ok, %d empty, %d skipped, %d failed",
        counts["ok"],
        counts["empty"],
        counts["skipped"],
        counts["failed"],
    )
    return counts


def merge_from_cache(
    *,
    source: Source,
    corpus_path: Path | None = None,
    output_path: Path | None = None,
    cache_dir: Path | None = None,
) -> int:
    """Rebuild slr_references.json from corpus + per-SLR cache files."""
    sp = SourcePaths(source)
    refs_by_slr = fr.run(
        corpus_path=corpus_path or sp.corpus,
        output_path=output_path or sp.refs_out,
        cache_dir=cache_dir or sp.refs_cache,
    )
    return len(refs_by_slr)


def missing_references_csv_path(source: Source) -> Path:
    return REPO_ROOT / "data" / "manual" / source / "slrs_missing_references.csv"


def refresh_missing_references_csv(
    *,
    source: Source,
    corpus_path: Path | None = None,
    refs_path: Path | None = None,
    output_csv: Path | None = None,
) -> int:
    """Write/update the missing-references tracker CSV from current corpus + refs.

    Returns the number of SLRs with an empty reference list.
    """
    sp = SourcePaths(source)
    corpus_path = corpus_path or sp.corpus
    refs_path = refs_path or sp.refs_out
    output_csv = output_csv or missing_references_csv_path(source)

    corpus = json.loads(corpus_path.read_text(encoding="utf-8"))
    refs: dict[str, list] = {}
    if refs_path.exists():
        refs = json.loads(refs_path.read_text(encoding="utf-8"))

    by_key = {p["_paper_key"]: p for p in corpus if p.get("_paper_key")}
    empty_keys: set[str] = {k for k, v in refs.items() if not v}
    for key in by_key:
        if key not in refs or not refs.get(key):
            empty_keys.add(key)

    fieldnames = [
        "paper_key",
        "title",
        "year",
        "venue",
        "doi",
        "paperId",
        "classification_type",
        "refs_cache_filename",
        "manual_refs_status",
        "notes",
    ]
    rows: list[dict[str, str]] = []
    for key in sorted(empty_keys):
        p = by_key.get(key, {})
        ext = p.get("externalIds") or {}
        doi = p.get("doi") or ext.get("DOI") or ""
        rows.append(
            {
                "paper_key": key,
                "title": p.get("title", ""),
                "year": p.get("year", ""),
                "venue": p.get("venue", ""),
                "doi": doi,
                "paperId": p.get("paperId", ""),
                "classification_type": p.get("_classification_type", ""),
                "refs_cache_filename": f"{fr._safe_filename(key)}.json",
                "manual_refs_status": "pending",
                "notes": "",
            }
        )

    output_csv.parent.mkdir(parents=True, exist_ok=True)
    with output_csv.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    logger.info("Wrote %d SLRs with empty refs to %s", len(rows), output_csv)
    return len(rows)


def backfill_missing_references(
    *,
    source: Source,
    corpus_path: Path | None = None,
    refs_path: Path | None = None,
    cache_dir: Path | None = None,
    merge: bool = True,
    overwrite_empty: bool = True,
    force: bool = False,
) -> dict[str, int]:
    """Pipeline hook: refresh missing-refs CSV, Crossref backfill, optional merge."""
    sp = SourcePaths(source)
    load_config()

    n_empty = refresh_missing_references_csv(
        source=source,
        corpus_path=corpus_path,
        refs_path=refs_path,
    )
    if n_empty == 0:
        logger.info("No SLRs with empty references; skipping Crossref backfill")
        if merge:
            merge_from_cache(
                source=source,
                corpus_path=corpus_path,
                output_path=refs_path,
                cache_dir=cache_dir,
            )
        return {"ok": 0, "empty": 0, "skipped": 0, "failed": 0, "n_empty": 0}

    input_csv = missing_references_csv_path(source)
    counts = run(
        source=source,
        input_csv=input_csv,
        cache_dir=cache_dir or sp.refs_cache,
        overwrite_empty=overwrite_empty,
        force=force,
    )
    counts["n_empty"] = n_empty
    if merge:
        merge_from_cache(
            source=source,
            corpus_path=corpus_path,
            output_path=refs_path,
            cache_dir=cache_dir,
        )
    return counts


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch SLR references from Crossref by DOI.")
    parser.add_argument("--source", choices=["acm", "ss", "ieee"], default="ss")
    parser.add_argument(
        "--input",
        type=Path,
        default=None,
        help="CSV of SLRs to backfill (default: data/manual/<source>/slrs_missing_references.csv)",
    )
    parser.add_argument(
        "--overwrite-empty",
        action="store_true",
        default=True,
        help="Replace cache files that contain an empty list (default: true).",
    )
    parser.add_argument(
        "--no-overwrite-empty",
        action="store_false",
        dest="overwrite_empty",
        help="Skip SLRs whose cache file already exists (even if empty).",
    )
    parser.add_argument("--force", action="store_true", help="Refetch even if cache file is non-empty.")
    parser.add_argument(
        "--merge",
        action="store_true",
        help="After fetching, rebuild data/processed/<source>/slr_references.json from caches.",
    )
    args = parser.parse_args()

    sp = SourcePaths(args.source)  # type: ignore[arg-type]
    input_csv = args.input or (REPO_ROOT / "data" / "manual" / args.source / "slrs_missing_references.csv")

    load_config()  # ensure config loads; mailto optional via env
    counts = run(
        source=args.source,  # type: ignore[arg-type]
        input_csv=input_csv,
        cache_dir=sp.refs_cache,
        overwrite_empty=args.overwrite_empty,
        force=args.force,
    )
    print(
        f"Crossref: {counts['ok']} ok, {counts['empty']} empty, "
        f"{counts['skipped']} skipped, {counts['failed']} failed"
    )
    print(f"Updated {input_csv.relative_to(REPO_ROOT)}")

    if args.merge:
        n = merge_from_cache(source=args.source)  # type: ignore[arg-type]
        print(f"Merged references for {n} SLRs into {sp.refs_out.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
