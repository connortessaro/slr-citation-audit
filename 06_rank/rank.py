"""Compute the 5-dim composite ranking for each SLR.

Dimensions (each normalized to [0, 1] across the corpus):
    1. coverage              -- canonical-paper recall from overlap_matrix.csv
    2. semantic              -- mean cosine(SLR_vec, ref_vec) across refs
    3. authority             -- mean log1p(citationCount) over refs (min-max scaled)
    4. diversity             -- 0.5 * H_norm(venues) + 0.5 * H_norm(first_authors)
    5. llm_judge             -- mean of 5 rubric sub-dims / 5.0 (already in [0.2, 1.0])

Composite = weighted sum; weights from cfg.rank_weights (default 0.2 each, renormalized).

Inputs:
    data/processed/slr_corpus.json
    data/processed/slr_references.json
    data/processed/overlap_matrix.csv          -- coverage_pct per SLR
    data/processed/paper_metadata.json         -- refs w/ citation count, venue, authors
    data/processed/embeddings.npz              -- vectors for refs and SLRs
    data/processed/llm_judge_scores.json       -- per-SLR rubric (optional)
Outputs:
    data/processed/ranked_slrs.csv
    data/processed/ranked_slrs.json
    report/ranking_report.md
"""
from __future__ import annotations

import csv
import json
import logging
import math
import sys
from collections import Counter
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lib.config import REPO_ROOT, load as load_config  # noqa: E402
from lib.paperid import paper_key  # noqa: E402

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

CORPUS_PATH = REPO_ROOT / "data" / "processed" / "slr_corpus.json"
REFS_PATH = REPO_ROOT / "data" / "processed" / "slr_references.json"
OVERLAP_PATH = REPO_ROOT / "data" / "processed" / "overlap_matrix.csv"
METADATA_PATH = REPO_ROOT / "data" / "processed" / "paper_metadata.json"
EMBEDDINGS_PATH = REPO_ROOT / "data" / "processed" / "embeddings.npz"
JUDGE_PATH = REPO_ROOT / "data" / "processed" / "llm_judge_scores.json"
RANKED_CSV = REPO_ROOT / "data" / "processed" / "ranked_slrs.csv"
RANKED_JSON = REPO_ROOT / "data" / "processed" / "ranked_slrs.json"
REPORT_PATH = REPO_ROOT / "report" / "ranking_report.md"

DIM_NAMES = ("coverage", "semantic", "authority", "diversity", "llm_judge")


# ---------- pure scoring functions ----------

def shannon_entropy_normalized(items: list[str]) -> float:
    """Shannon entropy / log(unique_n). Returns 0 if <=1 distinct item."""
    cleaned = [i for i in items if i]
    if len(cleaned) <= 1:
        return 0.0
    counts = Counter(cleaned)
    total = sum(counts.values())
    if total == 0:
        return 0.0
    h = -sum((c / total) * math.log(c / total) for c in counts.values())
    max_h = math.log(len(counts)) if len(counts) > 1 else 1.0
    return h / max_h if max_h > 0 else 0.0


def diversity_score(refs: list[dict]) -> float:
    """Avg of normalized venue entropy and first-author entropy."""
    venues = [(r.get("venue") or "").strip().lower() for r in refs]
    first_authors: list[str] = []
    for r in refs:
        authors = r.get("authors") or []
        if isinstance(authors, list) and authors:
            head = authors[0]
            if isinstance(head, dict):
                first_authors.append((head.get("name") or "").strip().lower())
            elif isinstance(head, str):
                first_authors.append(head.strip().lower())
    return 0.5 * shannon_entropy_normalized(venues) + 0.5 * shannon_entropy_normalized(first_authors)


def authority_score(refs: list[dict]) -> float:
    """Mean log1p(citationCount) over refs. Raw (unnormalized across corpus)."""
    counts = [r.get("citationCount") or 0 for r in refs]
    if not counts:
        return 0.0
    return float(np.mean([math.log1p(max(0, c)) for c in counts]))


def semantic_score(slr_vec: np.ndarray | None, ref_vecs: list[np.ndarray]) -> float:
    """Mean cosine similarity (vectors must be L2-normalized)."""
    if slr_vec is None or not ref_vecs:
        return 0.0
    stack = np.vstack(ref_vecs)
    sims = stack @ slr_vec
    return float(np.mean(sims))


def llm_judge_score(payload: dict | None) -> float:
    """Aggregate the 5 rubric sub-dims into [0.2, 1.0]. None -> 0.0 (no signal)."""
    if not payload:
        return 0.0
    score = payload.get("score") or payload
    dims = ("coverage", "recency", "diversity", "methodology", "comprehensiveness")
    vals: list[float] = []
    for d in dims:
        v = score.get(d)
        if isinstance(v, (int, float)) and 1 <= v <= 5:
            vals.append(float(v))
    if not vals:
        # Payload was present but unparseable -- surface the data quality issue.
        logger.warning("llm_judge payload contained no valid 1-5 dims: %r", score)
        return 0.0
    return sum(vals) / (5.0 * len(vals))


def min_max_normalize(values: list[float]) -> list[float]:
    """Scale to [0, 1]. Returns 0.5 for everyone if all equal. Empty -> []."""
    if not values:
        return []
    lo, hi = min(values), max(values)
    if hi - lo < 1e-12:
        return [0.5 for _ in values]
    return [(v - lo) / (hi - lo) for v in values]


def composite(dims: dict[str, float], weights: tuple[float, ...]) -> float:
    """Weighted sum of dims in DIM_NAMES order. Weights are renormalized to sum 1."""
    total = sum(weights) or 1.0
    norm_weights = [w / total for w in weights]
    return sum(dims[name] * w for name, w in zip(DIM_NAMES, norm_weights))


# ---------- loaders ----------

def _load_overlap_coverage(path: Path) -> dict[str, float]:
    """{slr_id: coverage as fraction in [0,1]}. Missing/blank -> 0.0."""
    out: dict[str, float] = {}
    with path.open("r", encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            pct = row.get("coverage_pct", "")
            try:
                out[row["slr_id"]] = float(pct) / 100.0
            except (TypeError, ValueError):
                out[row["slr_id"]] = 0.0
    return out


def _load_embeddings(path: Path) -> dict[str, np.ndarray]:
    cache = np.load(path, allow_pickle=False)
    keys = [str(k) for k in cache["keys"]]
    vecs = cache["vecs"]
    return {k: vecs[i] for i, k in enumerate(keys)}


def _load_judge(path: Path) -> dict[str, dict]:
    if not path.exists():
        logger.warning("LLM judge output missing (%s) -- llm_judge dim will be 0", path)
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


# ---------- pipeline ----------

def _compute_raw_dims(
    corpus: list[dict],
    refs_by_slr: dict[str, list[dict]],
    coverage_map: dict[str, float],
    metadata: dict[str, dict],
    embeddings: dict[str, np.ndarray],
    judge_map: dict[str, dict],
) -> list[dict]:
    """One row per SLR with raw (un-normalized) dim values."""
    rows: list[dict] = []
    for slr in corpus:
        slr_key = slr.get("_paper_key") or paper_key(slr)
        refs = refs_by_slr.get(slr_key, [])
        # Attach metadata fields where ref records are sparse.
        merged_refs: list[dict] = []
        for ref in refs:
            rkey = ref.get("paper_key") or paper_key(ref)
            md = metadata.get(rkey, {})
            merged = dict(ref)
            for k in ("abstract", "authors", "venue", "citationCount"):
                if merged.get(k) in (None, "", []) and md.get(k) not in (None, "", []):
                    merged[k] = md[k]
            merged["_key"] = rkey
            merged_refs.append(merged)

        ref_vecs = [embeddings[r["_key"]] for r in merged_refs if r["_key"] in embeddings]
        slr_vec = embeddings.get(slr_key)

        rows.append({
            "slr_key": slr_key,
            "slr_title": slr.get("title"),
            "slr_year": slr.get("year"),
            "slr_venue": slr.get("venue"),
            "n_refs": len(merged_refs),
            "n_refs_embedded": len(ref_vecs),
            "raw": {
                "coverage": coverage_map.get(slr_key, 0.0),
                "semantic": semantic_score(slr_vec, ref_vecs),
                "authority": authority_score(merged_refs),
                "diversity": diversity_score(merged_refs),
                "llm_judge": llm_judge_score(judge_map.get(slr_key)),
            },
            "judge_justification": (
                (judge_map.get(slr_key) or {}).get("score", {}).get("justification")
                if judge_map.get(slr_key) else None
            ),
        })
    return rows


def _normalize_dims(rows: list[dict]) -> None:
    """In-place: add `normalized` dict to each row. min-max across corpus per dim."""
    for dim in DIM_NAMES:
        raw_vals = [r["raw"][dim] for r in rows]
        normalized = min_max_normalize(raw_vals)
        for r, nv in zip(rows, normalized):
            r.setdefault("normalized", {})[dim] = nv


def _write_outputs(
    rows: list[dict],
    weights: tuple[float, ...],
    csv_path: Path,
    json_path: Path,
    report_path: Path,
) -> list[dict]:
    """Compute composite + rank, write CSV/JSON/MD, return rows in rank order."""
    for r in rows:
        r["composite"] = composite(r["normalized"], weights)
    rows_sorted = sorted(rows, key=lambda r: r["composite"], reverse=True)
    for i, r in enumerate(rows_sorted, start=1):
        r["rank"] = i

    # CSV
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "rank", "slr_key", "slr_title", "slr_year", "slr_venue",
        "composite", *DIM_NAMES, "n_refs", "n_refs_embedded",
    ]
    with csv_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows_sorted:
            row = {
                "rank": r["rank"],
                "slr_key": r["slr_key"],
                "slr_title": r["slr_title"],
                "slr_year": r["slr_year"],
                "slr_venue": r["slr_venue"],
                "composite": round(r["composite"], 4),
                "n_refs": r["n_refs"],
                "n_refs_embedded": r["n_refs_embedded"],
                **{d: round(r["normalized"][d], 4) for d in DIM_NAMES},
            }
            w.writerow(row)

    # JSON (full breakdown)
    json_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(rows_sorted, indent=2, sort_keys=True), encoding="utf-8")

    # Markdown report
    _write_report(rows_sorted, weights, report_path)
    return rows_sorted


def _write_report(rows_sorted: list[dict], weights: tuple[float, ...], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # Avoid overlap when corpus has <=10 SLRs (top and bottom slices would collide).
    n = len(rows_sorted)
    top = rows_sorted[:5]
    bottom = rows_sorted[max(5, n - 5):] if n > 5 else []
    lines = [
        "# SLR Citation-Quality Ranking",
        "",
        "Composite ranking of technical-debt SLRs by citation quality across 5 dimensions.",
        "",
        "## Method",
        "",
        f"Dimensions ({len(DIM_NAMES)}, equal-weighted by default):",
        "",
        "- **coverage** — canonical-paper recall (date-controlled top-cited subfield papers cited).",
        "- **semantic** — mean cosine similarity between SLR embedding and each ref embedding (SPECTER/Qwen3).",
        "- **authority** — mean log(1 + citationCount) of references.",
        "- **diversity** — Shannon entropy of cited venues and first authors (normalized).",
        "- **llm_judge** — DeepSeek V3 5-dim rubric (coverage, recency, diversity, methodology, comprehensiveness).",
        "",
        f"Weights: {', '.join(f'{d}={w:.2f}' for d, w in zip(DIM_NAMES, weights))}",
        "",
        "Each raw dim is min-max normalized across the SLR corpus; composite = weighted sum.",
        "",
        "## Top 5 SLRs",
        "",
        "| Rank | SLR | Year | Composite | Cov | Sem | Auth | Div | Judge |",
        "|------|-----|------|-----------|-----|-----|------|-----|-------|",
    ]
    for r in top:
        lines.append(
            f"| {r['rank']} | {(r['slr_title'] or '')[:80]} | {r['slr_year'] or ''} | "
            f"{r['composite']:.3f} | {r['normalized']['coverage']:.2f} | "
            f"{r['normalized']['semantic']:.2f} | {r['normalized']['authority']:.2f} | "
            f"{r['normalized']['diversity']:.2f} | {r['normalized']['llm_judge']:.2f} |"
        )

    if not bottom:
        lines.append("")
        lines.append("_(Corpus too small to show a separate bottom-5 list.)_")
    else:
        lines += ["", "## Bottom 5 SLRs", "",
                  "| Rank | SLR | Year | Composite | Cov | Sem | Auth | Div | Judge |",
                  "|------|-----|------|-----------|-----|-----|------|-----|-------|"]
    for r in bottom:
        lines.append(
            f"| {r['rank']} | {(r['slr_title'] or '')[:80]} | {r['slr_year'] or ''} | "
            f"{r['composite']:.3f} | {r['normalized']['coverage']:.2f} | "
            f"{r['normalized']['semantic']:.2f} | {r['normalized']['authority']:.2f} | "
            f"{r['normalized']['diversity']:.2f} | {r['normalized']['llm_judge']:.2f} |"
        )

    lines += [
        "",
        "## Limitations",
        "",
        "- Single citation source (Semantic Scholar).",
        "- Semantic dim sensitive to abstract/full-text availability; missing refs degrade signal.",
        "- LLM judge is one model (DeepSeek V3) at temperature 0 -- still has provider drift; cached.",
        "- Authority is citation-count based; PageRank over a richer subfield graph is future work.",
        "",
        "_Generated by `06_rank/rank.py`. See `data/processed/ranked_slrs.json` for full per-SLR breakdown including LLM judge justifications._",
    ]
    path.write_text("\n".join(lines), encoding="utf-8")


def run(
    corpus_path: Path = CORPUS_PATH,
    refs_path: Path = REFS_PATH,
    overlap_path: Path = OVERLAP_PATH,
    metadata_path: Path = METADATA_PATH,
    embeddings_path: Path = EMBEDDINGS_PATH,
    judge_path: Path = JUDGE_PATH,
    csv_path: Path = RANKED_CSV,
    json_path: Path = RANKED_JSON,
    report_path: Path = REPORT_PATH,
) -> list[dict]:
    for p in (corpus_path, refs_path, overlap_path, metadata_path, embeddings_path):
        if not p.exists():
            raise FileNotFoundError(f"Missing required input: {p}")
    cfg = load_config()

    corpus = json.loads(corpus_path.read_text(encoding="utf-8"))
    refs_by_slr = json.loads(refs_path.read_text(encoding="utf-8"))
    coverage_map = _load_overlap_coverage(overlap_path)
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    embeddings = _load_embeddings(embeddings_path)
    judge_map = _load_judge(judge_path)

    rows = _compute_raw_dims(corpus, refs_by_slr, coverage_map, metadata, embeddings, judge_map)
    if not rows:
        logger.warning("No SLR rows produced (empty corpus); writing empty outputs and skipping ranking.")
        csv_path.parent.mkdir(parents=True, exist_ok=True)
        csv_path.write_text("", encoding="utf-8")
        json_path.write_text("[]", encoding="utf-8")
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text("# SLR Citation-Quality Ranking\n\n_Empty corpus._\n", encoding="utf-8")
        return []
    _normalize_dims(rows)
    rows_sorted = _write_outputs(rows, cfg.rank_weights, csv_path, json_path, report_path)
    logger.info(
        "Ranked %d SLRs -> %s / %s / %s",
        len(rows_sorted),
        csv_path.relative_to(REPO_ROOT),
        json_path.relative_to(REPO_ROOT),
        report_path.relative_to(REPO_ROOT),
    )
    return rows_sorted


def main() -> None:
    rows_sorted = run()
    print(f"Ranked {len(rows_sorted)} SLRs")
    for r in rows_sorted[:3]:
        print(f"  #{r['rank']} {r['composite']:.3f}  {(r['slr_title'] or '')[:70]}")


if __name__ == "__main__":
    main()
