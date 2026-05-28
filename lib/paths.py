"""Compatibility re-export for the shared core paths.

New code should import from `core.paths`.
"""

from core.paths import (  # noqa: F401
    Source,
    SourcePaths,
    candidates_input_path,
    candidates_output_path,
    candidates_preview_output_path,
    corpus_path,
    exports_dir,
    gap_analysis_path,
    manual_dir,
    missed_pairs_path,
    overlap_matrix_path,
    processed_dir,
    raw_dir,
    references_path,
    refs_cache_dir,
    slr_decisions_path,
)

