"""Fetch full reference list for each SLR via Semantic Scholar.

Input: data/processed/slr_corpus.json
Output: data/processed/slr_references.json
        (map of SLR id -> list of cited paper ids/DOIs/metadata)
"""
from __future__ import annotations


def main() -> None:
    raise NotImplementedError("TODO: SS /paper/{id}/references with pagination")


if __name__ == "__main__":
    main()
