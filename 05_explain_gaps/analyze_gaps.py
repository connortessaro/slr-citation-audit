"""Investigate causes of citation gaps.

For each (SLR, missed top-cited paper) pair, attach explanatory features:
    - venue (workshop/conference/journal/preprint)
    - publication year vs SLR year
    - open-access status
    - language
    - venue indexed in ACM/IEEE/elsewhere

Inputs:
    data/processed/overlap_matrix.csv
    data/processed/top_cited_techdebt.json
Output:
    data/processed/gap_analysis.csv
"""
from __future__ import annotations


def main() -> None:
    raise NotImplementedError("TODO: enrich with venue/year/access features")


if __name__ == "__main__":
    main()
