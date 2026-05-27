"""Merge candidate lists, deduplicate by DOI / title, flag SLR vs survey.

Reads data/raw/{ss,acm,ieee}_slr_candidates.json + data/manual/slr_decisions.csv
Output: data/processed/slr_corpus.json
"""
from __future__ import annotations


def main() -> None:
    raise NotImplementedError("TODO: dedup + apply manual SLR classification")


if __name__ == "__main__":
    main()
