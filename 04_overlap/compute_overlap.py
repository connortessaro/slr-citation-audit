"""Compute citation overlap between each SLR and the top-cited corpus.

For each SLR: filter top-cited list by pub_year <= SLR.pub_year (date control),
then compute fraction of that filtered top-cited set appearing in the SLR's refs.

Inputs:
    data/processed/slr_corpus.json
    data/processed/slr_references.json
    data/processed/top_cited_techdebt.json
Output:
    data/processed/overlap_matrix.csv
"""
from __future__ import annotations


def main() -> None:
    raise NotImplementedError("TODO: per-SLR date-controlled overlap")


if __name__ == "__main__":
    main()
