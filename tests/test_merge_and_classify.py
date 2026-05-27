import csv
import json
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "01_identify_slrs"))
import merge_and_classify as mc  # noqa: E402


KEYWORDS = ["technical debt", "design debt", "code debt"]
SLR_PATTERNS = ["systematic literature review", "systematic review", "systematic mapping"]


def _paper(**overrides) -> dict:
    base = {
        "title": "A Systematic Literature Review of Technical Debt",
        "abstract": "We searched ACM, IEEE and Scopus using a search string and applied inclusion criteria following Kitchenham.",
        "year": 2018,
        "venue": "Empirical Software Engineering",
        "doi": "10.1109/X.2018.1",
        "source": "semanticscholar",
    }
    base.update(overrides)
    return base


class TestClassify:
    def test_includes_well_formed_slr(self):
        verdict, _, ptype = mc._classify(_paper(), KEYWORDS, SLR_PATTERNS, 2000, 2025)
        assert verdict == "INCLUDE"
        assert ptype == "slr"

    def test_marks_mapping_as_sms(self):
        verdict, _, ptype = mc._classify(
            _paper(title="Systematic Mapping of Technical Debt Management"),
            KEYWORDS, SLR_PATTERNS, 2000, 2025,
        )
        assert verdict == "INCLUDE"
        assert ptype == "sms"

    def test_excludes_off_subfield(self):
        verdict, reason, _ = mc._classify(
            _paper(title="A Systematic Literature Review of Refactoring", abstract="Refactoring methods."),
            KEYWORDS, SLR_PATTERNS, 2000, 2025,
        )
        assert verdict == "EXCLUDE"
        assert "subfield" in reason

    def test_excludes_no_slr_label(self):
        verdict, reason, _ = mc._classify(
            _paper(title="A Survey of Technical Debt", abstract="An overview of the field."),
            KEYWORDS, SLR_PATTERNS, 2000, 2025,
        )
        assert verdict == "EXCLUDE"
        assert "SLR/SMS self-label" in reason

    def test_excludes_no_methodology_signal(self):
        verdict, reason, _ = mc._classify(
            _paper(abstract="We discuss technical debt informally."),
            KEYWORDS, SLR_PATTERNS, 2000, 2025,
        )
        assert verdict == "EXCLUDE"
        assert "methodology" in reason

    def test_excludes_out_of_year_range(self):
        verdict, reason, _ = mc._classify(
            _paper(year=1999),
            KEYWORDS, SLR_PATTERNS, 2000, 2025,
        )
        assert verdict == "EXCLUDE"
        assert "year" in reason


class TestEndToEnd:
    def test_pipeline_emits_corpus_and_decisions(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        ss_path = tmp_path / "ss.json"
        acm_path = tmp_path / "acm.json"
        ieee_path = tmp_path / "ieee.json"
        ss_path.write_text(json.dumps([_paper()]))
        acm_path.write_text(json.dumps([_paper(title="Survey of Technical Debt", doi="10.1/x")]))
        ieee_path.write_text(json.dumps([_paper(doi="10.1109/Y.2020.1", year=2020, title="Systematic Mapping of Technical Debt")]))

        decisions = tmp_path / "decisions.csv"
        corpus = tmp_path / "corpus.json"
        monkeypatch.setattr(mc, "CANDIDATE_PATHS", {"semanticscholar": ss_path, "acm": acm_path, "ieee": ieee_path})
        monkeypatch.setattr(mc, "DECISIONS_PATH", decisions)
        monkeypatch.setattr(mc, "CORPUS_PATH", corpus)

        included = mc.run()
        assert len(included) == 2

        with decisions.open() as f:
            rows = list(csv.DictReader(f))
        verdicts = sorted(r["verdict"] for r in rows)
        assert verdicts == ["EXCLUDE", "INCLUDE", "INCLUDE"]

        loaded_corpus = json.loads(corpus.read_text())
        assert {p["_classification_type"] for p in loaded_corpus} == {"slr", "sms"}
