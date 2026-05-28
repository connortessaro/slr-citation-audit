"""Path helpers for per-source ("siloed") pipeline outputs."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from core.config import REPO_ROOT

Source = Literal["acm", "ss", "ieee"]


def _raw_root() -> Path:
    return REPO_ROOT / "data" / "raw"


def _processed_root() -> Path:
    return REPO_ROOT / "data" / "processed"


def _manual_root() -> Path:
    return REPO_ROOT / "data" / "manual"


def raw_dir(source: Source) -> Path:
    return _raw_root() / source


def processed_dir(source: Source) -> Path:
    return _processed_root() / source


def manual_dir(source: Source) -> Path:
    return _manual_root() / source


def candidates_output_path(source: Source) -> Path:
    return raw_dir(source) / "slr_candidates.json"


def candidates_preview_output_path(source: Source) -> Path:
    return raw_dir(source) / "slr_candidates.preview.json"


def candidates_input_path(source: Source) -> Path:
    """Preferred input path with legacy fallback for existing repos."""
    preferred = candidates_output_path(source)
    if preferred.exists():
        return preferred

    legacy_map: dict[Source, Path] = {
        "ss": _raw_root() / "ss_slr_candidates.json",
        "acm": _raw_root() / "acm_slr_candidates.json",
        "ieee": _raw_root() / "ieee_slr_candidates.json",
    }
    legacy = legacy_map[source]
    return legacy if legacy.exists() else preferred


def exports_dir(source: Source) -> Path:
    if source == "acm":
        preferred = raw_dir(source) / "exports"
        legacy = _raw_root() / "acm_exports"
        return legacy if legacy.exists() and not preferred.exists() else preferred
    if source == "ieee":
        preferred = raw_dir(source) / "exports"
        legacy = _raw_root() / "ieee_exports"
        return legacy if legacy.exists() and not preferred.exists() else preferred
    raise ValueError("Semantic Scholar has no exports dir")


def refs_cache_dir(source: Source) -> Path:
    return raw_dir(source) / "refs"


def corpus_path(source: Source) -> Path:
    return processed_dir(source) / "slr_corpus.json"


def references_path(source: Source) -> Path:
    return processed_dir(source) / "slr_references.json"


def overlap_matrix_path(source: Source) -> Path:
    return processed_dir(source) / "overlap_matrix.csv"


def missed_pairs_path(source: Source) -> Path:
    return processed_dir(source) / "missed_pairs.csv"


def gap_analysis_path(source: Source) -> Path:
    return processed_dir(source) / "gap_analysis.csv"


def slr_decisions_path(source: Source) -> Path:
    return manual_dir(source) / "slr_decisions.csv"


@dataclass(frozen=True)
class SourcePaths:
    source: Source

    @property
    def candidates_in(self) -> Path:
        return candidates_input_path(self.source)

    @property
    def candidates_out(self) -> Path:
        return candidates_output_path(self.source)

    @property
    def corpus(self) -> Path:
        return corpus_path(self.source)

    @property
    def decisions(self) -> Path:
        return slr_decisions_path(self.source)

    @property
    def refs_cache(self) -> Path:
        return refs_cache_dir(self.source)

    @property
    def refs_out(self) -> Path:
        return references_path(self.source)

    @property
    def overlap_out(self) -> Path:
        return overlap_matrix_path(self.source)

    @property
    def missed_out(self) -> Path:
        return missed_pairs_path(self.source)

    @property
    def gaps_out(self) -> Path:
        return gap_analysis_path(self.source)

