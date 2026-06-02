"""Remove SLRs with no usable reference list from the analysis corpus.

Runs after reference extraction (and optional Crossref backfill). SLRs with zero
reference keys are excluded from ``slr_corpus.json`` and marked EXCLUDE in the
decisions audit trail.

Inputs:
    data/processed/<source>/slr_corpus.json
    data/processed/<source>/slr_references.json
Outputs:
    data/processed/<source>/slr_corpus.json  (rewritten, SLRs with refs only)
    data/manual/<source>/slr_decisions.csv   (verdict updated for pruned SLRs)
"""
from __future__ import annotations

import argparse
import csv
import json
import logging
from pathlib import Path

from lib.config import REPO_ROOT, load as load_config
from lib.paperid import paper_key
from lib.paths import Source, SourcePaths
from lib.slr_refs import filter_corpus_with_refs

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

EXCLUDE_REASON = "no reference list available (Semantic Scholar and Crossref)"


def _load_decisions(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def _write_decisions(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "paper_key",
        "title",
        "year",
        "venue",
        "source",
        "verdict",
        "reason",
        "type",
        "override_verdict",
    ]
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({k: row.get(k, "") for k in fieldnames})


def _mark_excluded_in_decisions(decision_rows: list[dict], excluded_keys: set[str]) -> int:
    updated = 0
    for row in decision_rows:
        if row.get("paper_key") not in excluded_keys:
            continue
        if row.get("verdict") == "EXCLUDE":
            continue
        row["verdict"] = "EXCLUDE"
        row["reason"] = EXCLUDE_REASON
        updated += 1
    return updated


def run(
    *,
    source: Source,
    corpus_path: Path | None = None,
    refs_path: Path | None = None,
    decisions_path: Path | None = None,
    dry_run: bool = False,
) -> dict[str, int]:
    sp = SourcePaths(source)
    corpus_path = corpus_path or sp.corpus
    refs_path = refs_path or sp.refs_out
    decisions_path = decisions_path or sp.decisions

    for p in (corpus_path, refs_path):
        if not p.exists():
            raise FileNotFoundError(f"Missing required input: {p}")

    corpus = json.loads(corpus_path.read_text(encoding="utf-8"))
    refs_by_slr = json.loads(refs_path.read_text(encoding="utf-8"))
    included, excluded = filter_corpus_with_refs(corpus, refs_by_slr)
    excluded_keys = {s.get("_paper_key") or paper_key(s) for s in excluded}

    stats = {
        "corpus_before": len(corpus),
        "corpus_after": len(included),
        "excluded": len(excluded),
        "decisions_updated": 0,
    }

    if dry_run:
        logger.info(
            "%s prune (dry-run): would keep %d, exclude %d SLRs with no references",
            source.upper(),
            len(included),
            len(excluded),
        )
        return stats

    corpus_path.write_text(json.dumps(included, indent=2, sort_keys=True), encoding="utf-8")
    logger.info(
        "%s corpus: %d -> %d SLRs (%d excluded, no references)",
        source.upper(),
        len(corpus),
        len(included),
        len(excluded),
    )

    if decisions_path.exists() and excluded_keys:
        rows = _load_decisions(decisions_path)
        stats["decisions_updated"] = _mark_excluded_in_decisions(rows, excluded_keys)
        _write_decisions(decisions_path, rows)
        try:
            decisions_label = str(decisions_path.relative_to(REPO_ROOT))
        except ValueError:
            decisions_label = str(decisions_path)
        logger.info(
            "Updated %d decision rows to EXCLUDE in %s",
            stats["decisions_updated"],
            decisions_label,
        )

    return stats


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Exclude SLRs with empty reference lists from the analysis corpus.",
    )
    parser.add_argument("--source", required=True, choices=["acm", "ss", "ieee"])
    parser.add_argument("--corpus", type=Path, default=None)
    parser.add_argument("--refs", type=Path, default=None)
    parser.add_argument("--decisions", type=Path, default=None)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    load_config()  # ensure config exists
    stats = run(
        source=args.source,  # type: ignore[arg-type]
        corpus_path=args.corpus,
        refs_path=args.refs,
        decisions_path=args.decisions,
        dry_run=args.dry_run,
    )
    print(
        f"Corpus {stats['corpus_before']} -> {stats['corpus_after']} "
        f"({stats['excluded']} excluded, no references)"
    )


if __name__ == "__main__":
    main()
