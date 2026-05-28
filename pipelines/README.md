## Pipelines (database-first)

This folder provides **database-first entrypoints** so each dataset can be run
fully independently:

- `pipelines/ss/` (Semantic Scholar SLR discovery)
- `pipelines/acm/` (ACM DL exports → candidates)
- `pipelines/ieee/` (IEEE Xplore API or exports → candidates)

All pipelines write to the same per-source data layout:

- `data/raw/<source>/...`
- `data/processed/<source>/...`
- `data/manual/<source>/...`

The stage folders (`01_identify_slrs/` ... `05_explain_gaps/`) still exist as
shared, reusable building blocks.

