# 2026-05-28 - Crossref reference backfill for SS SLRs

## Summary

Added `02_extract_refs/fetch_references_crossref.py` to fetch bibliography metadata from the **Crossref Works API** for SLRs where Semantic Scholar returned no references. Output uses the **same per-SLR cache JSON schema** as `fetch_references.py` (`paper_key`, `title`, `year`, `doi`, `venue`, etc.).

## Usage

**Standalone:**

```bash
PYTHONPATH=. python3 02_extract_refs/fetch_references_crossref.py --source ss --merge
```

**SS pipeline (automatic after SS reference fetch):**

```bash
PYTHONPATH=. python3 pipelines/ss/run.py --skip-search
```

Use `--skip-crossref` to disable the backfill step.

- Refreshes `data/manual/ss/slrs_missing_references.csv` from empty entries in `slr_references.json`
- Writes cache files to `data/raw/ss/refs/<refs_cache_filename>`
- Rebuilds `data/processed/ss/slr_references.json` from corpus + caches

Optional: set `CROSSREF_MAILTO=you@example.com` for Crossref polite pool.

## First run results (SS)

- **30** SLRs backfilled with Crossref references
- **12** still empty (no reference list deposited in Crossref)
- **14** total empty in merged `slr_references.json` (includes SLRs without DOI / manual-only keys)

Remaining empties are mostly non-Crossref publishers, very new proceedings, or works without a DOI in the tracking CSV.
