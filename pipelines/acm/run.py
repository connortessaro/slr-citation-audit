"""Run the full pipeline for ACM dataset only."""

from __future__ import annotations

import argparse
import importlib.util
from types import ModuleType

from lib.config import REPO_ROOT
from lib.paths import SourcePaths

_REPO = REPO_ROOT


def _load_module(name: str, rel_path: str) -> ModuleType:
    path = _REPO / rel_path
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not load module {name} from {path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main() -> None:
    parser = argparse.ArgumentParser(description="Run ACM-only pipeline end-to-end.")
    parser.add_argument("--skip-identify", action="store_true", help="Skip ACM candidate generation from exports.")
    parser.add_argument("--skip-refs", action="store_true", help="Skip reference fetching step.")
    parser.add_argument("--skip-top", action="store_true", help="Skip top-cited refresh step.")
    parser.add_argument("--skip-figures", action="store_true", help="Skip figure rendering step.")
    args = parser.parse_args()

    acm_identify = _load_module("acm_identify", "01_identify_slrs/search_acm.py")
    classify = _load_module("classify_slrs", "01_identify_slrs/classify_slrs.py")
    fetch_refs = _load_module("fetch_references", "02_extract_refs/fetch_references.py")
    top_cited = _load_module("fetch_top_cited", "03_top_cited/fetch_top_cited.py")
    overlap = _load_module("compute_overlap", "04_overlap/compute_overlap.py")
    gaps = _load_module("analyze_gaps", "05_explain_gaps/analyze_gaps.py")
    figures = _load_module("build_figures", "report/build_figures.py")

    sp = SourcePaths("acm")

    if not args.skip_identify:
        acm_identify.run()

    classify.run(source="acm")

    if not args.skip_refs:
        fetch_refs.run(corpus_path=sp.corpus, output_path=sp.refs_out, cache_dir=sp.refs_cache)

    if not args.skip_top:
        top_cited.run()

    overlap.run(
        corpus_path=sp.corpus,
        refs_path=sp.refs_out,
        top_cited_path=_REPO / "data" / "processed" / "top_cited_techdebt.json",
        overlap_path=sp.overlap_out,
        missed_path=sp.missed_out,
    )
    gaps.run(
        missed_pairs_path=sp.missed_out,
        top_cited_path=_REPO / "data" / "processed" / "top_cited_techdebt.json",
        output_path=sp.gaps_out,
        summary_venue_path=sp.gaps_out.parent / "gap_summary_by_venue.csv",
        summary_age_path=sp.gaps_out.parent / "gap_summary_by_age.csv",
    )

    if not args.skip_figures:
        figures.run(sp.overlap_out, sp.gaps_out, _REPO / "report" / "figures" / "acm")

    print("Done. Outputs under:", (REPO_ROOT / "data" / "processed" / "acm").relative_to(REPO_ROOT))


if __name__ == "__main__":
    main()

