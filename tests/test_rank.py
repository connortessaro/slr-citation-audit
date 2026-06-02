"""Unit tests for 06_rank/ scoring functions and orchestration."""
from __future__ import annotations

import importlib
import math
import sys
from pathlib import Path

import numpy as np
import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(REPO_ROOT / "06_rank"))

rank = importlib.import_module("rank")  # 06_rank/rank.py
judge = importlib.import_module("judge")  # 06_rank/judge.py


# ---- shannon_entropy_normalized ----

def test_entropy_zero_for_empty_or_singleton():
    assert rank.shannon_entropy_normalized([]) == 0.0
    assert rank.shannon_entropy_normalized(["a"]) == 0.0
    assert rank.shannon_entropy_normalized(["", ""]) == 0.0


def test_entropy_one_for_uniform_distribution():
    # 4 distinct categories, each once -> entropy = log(4), normalized to 1.0
    assert rank.shannon_entropy_normalized(["a", "b", "c", "d"]) == pytest.approx(1.0)


def test_entropy_lower_for_skewed_distribution():
    skewed = ["a"] * 9 + ["b"]
    uniform = ["a"] * 5 + ["b"] * 5
    assert rank.shannon_entropy_normalized(skewed) < rank.shannon_entropy_normalized(uniform)


# ---- diversity_score ----

def test_diversity_zero_for_single_venue_single_author():
    refs = [
        {"venue": "ICSE", "authors": [{"name": "Smith"}]},
        {"venue": "ICSE", "authors": [{"name": "Smith"}]},
    ]
    assert rank.diversity_score(refs) == 0.0


def test_diversity_high_for_varied_refs():
    refs = [
        {"venue": "ICSE", "authors": [{"name": "Smith"}]},
        {"venue": "FSE", "authors": [{"name": "Jones"}]},
        {"venue": "ASE", "authors": [{"name": "Wong"}]},
        {"venue": "TSE", "authors": [{"name": "Patel"}]},
    ]
    assert rank.diversity_score(refs) == pytest.approx(1.0)


def test_diversity_handles_string_authors():
    refs = [
        {"venue": "ICSE", "authors": ["Smith"]},
        {"venue": "FSE", "authors": ["Jones"]},
    ]
    score = rank.diversity_score(refs)
    assert 0 < score <= 1.0


# ---- authority_score ----

def test_authority_zero_for_no_refs():
    assert rank.authority_score([]) == 0.0


def test_authority_log_scaled():
    refs = [{"citationCount": 0}, {"citationCount": 99}]
    expected = (math.log1p(0) + math.log1p(99)) / 2
    assert rank.authority_score(refs) == pytest.approx(expected)


def test_authority_handles_none_citation_count():
    refs = [{"citationCount": None}, {"citationCount": 10}]
    expected = (math.log1p(0) + math.log1p(10)) / 2
    assert rank.authority_score(refs) == pytest.approx(expected)


# ---- semantic_score ----

def test_semantic_zero_when_no_slr_vector():
    assert rank.semantic_score(None, [np.array([1.0, 0.0])]) == 0.0


def test_semantic_zero_when_no_refs():
    assert rank.semantic_score(np.array([1.0, 0.0]), []) == 0.0


def test_semantic_identity_when_refs_match_slr():
    vec = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    assert rank.semantic_score(vec, [vec, vec, vec]) == pytest.approx(1.0)


def test_semantic_orthogonal_refs_score_zero():
    slr = np.array([1.0, 0.0], dtype=np.float32)
    refs = [np.array([0.0, 1.0], dtype=np.float32), np.array([0.0, 1.0], dtype=np.float32)]
    assert rank.semantic_score(slr, refs) == pytest.approx(0.0)


# ---- llm_judge_score ----

def test_judge_zero_for_missing_payload():
    assert rank.llm_judge_score(None) == 0.0
    assert rank.llm_judge_score({}) == 0.0


def test_judge_normalizes_to_unit_interval():
    payload = {
        "score": {
            "coverage": 3, "recency": 3, "diversity": 3,
            "methodology": 3, "comprehensiveness": 3, "justification": "ok"
        }
    }
    assert rank.llm_judge_score(payload) == pytest.approx(0.6)  # 3/5


def test_judge_perfect_scores_yield_one():
    payload = {
        "score": {
            "coverage": 5, "recency": 5, "diversity": 5,
            "methodology": 5, "comprehensiveness": 5, "justification": "good"
        }
    }
    assert rank.llm_judge_score(payload) == pytest.approx(1.0)


def test_judge_accepts_flat_score_dict():
    flat = {"coverage": 4, "recency": 4, "diversity": 4, "methodology": 4, "comprehensiveness": 4}
    assert rank.llm_judge_score(flat) == pytest.approx(0.8)


# ---- min_max_normalize ----

def test_min_max_handles_constant_values():
    assert rank.min_max_normalize([7.0, 7.0, 7.0]) == [0.5, 0.5, 0.5]


def test_min_max_scales_to_unit_interval():
    assert rank.min_max_normalize([0.0, 5.0, 10.0]) == pytest.approx([0.0, 0.5, 1.0])


def test_min_max_empty_returns_empty():
    # Guard against empty-corpus ValueError.
    assert rank.min_max_normalize([]) == []


def test_judge_warns_on_malformed_payload(caplog):
    # Payload present but values out of range -> 0.0 + warning logged.
    payload = {"score": {"coverage": 99, "recency": 0, "diversity": -1,
                         "methodology": 7, "comprehensiveness": "five"}}
    with caplog.at_level("WARNING", logger="rank"):
        score = rank.llm_judge_score(payload)
    assert score == 0.0
    assert any("no valid 1-5 dims" in rec.message for rec in caplog.records)


# ---- composite ----

def test_composite_equal_weights():
    dims = {"coverage": 1.0, "semantic": 0.0, "authority": 0.5, "diversity": 0.5, "llm_judge": 0.0}
    weights = (0.2, 0.2, 0.2, 0.2, 0.2)
    assert rank.composite(dims, weights) == pytest.approx(0.4)


def test_composite_renormalizes_weights():
    dims = {"coverage": 1.0, "semantic": 1.0, "authority": 1.0, "diversity": 1.0, "llm_judge": 1.0}
    weights = (2, 2, 2, 2, 2)  # sums to 10, not 1
    assert rank.composite(dims, weights) == pytest.approx(1.0)


# ---- judge prompt building ----

def test_build_user_prompt_includes_slr_and_refs():
    slr = {"title": "An SLR", "year": 2020, "venue": "ICSE", "abstract": "We review X."}
    refs = [
        {"title": "Ref One", "year": 2015, "venue": "FSE", "abstract": "Found stuff"},
        {"title": "Ref Two", "year": 2018, "venue": "ASE", "abstract": "Other stuff"},
    ]
    prompt = judge._build_user_prompt(slr, None, refs)
    assert "An SLR" in prompt
    assert "Ref One" in prompt
    assert "Ref Two" in prompt
    assert "rubric" in prompt.lower() or "schema" in prompt.lower()


def test_build_user_prompt_truncates_fulltext():
    slr = {"title": "X", "year": 2020, "venue": "v", "abstract": "a"}
    long = "z" * (judge._SLR_FULLTEXT_CHARS + 1000)
    prompt = judge._build_user_prompt(slr, long, [])
    # Truncation kicks in; total prompt shouldn't carry the overflow.
    assert long not in prompt


# ---- judge: cache hit short-circuits API ----

class _StubClient:
    """Stub OpenAI client; raises if called (we want cache hit to skip)."""

    def __init__(self):
        self.calls: list[dict] = []

    @property
    def chat(self):
        raise AssertionError("StubClient.chat called; cache should have prevented this")


def test_judge_one_uses_cache(tmp_path, monkeypatch):
    cache_dir = tmp_path / "llm_judge"
    cache_dir.mkdir()
    monkeypatch.setattr(judge, "JUDGE_CACHE_DIR", cache_dir)

    cached_payload = {
        "score": {
            "coverage": 4, "recency": 3, "diversity": 4,
            "methodology": 3, "comprehensiveness": 4,
            "justification": "Adequate SLR with reasonable coverage."
        },
        "model": "stub",
        "response_id": "id1",
    }
    from lib.paperid import safe_filename
    safe = safe_filename("doi:10.1/test")
    (cache_dir / f"{safe}.json").write_text(
        __import__("json").dumps(cached_payload), encoding="utf-8"
    )

    out = judge._judge_one(
        client=_StubClient(),
        model_chain=["any/model"],
        slr_key="doi:10.1/test",
        slr={"title": "X", "year": 2020, "venue": "v", "abstract": "a"},
        refs=[],
    )
    assert out == cached_payload


# ---- regression: malformed judge cache + empty-corpus + no-signal dim ----

def test_compute_raw_dims_survives_null_score_payload():
    """Cached judge payload with score:null must not crash rank.py."""
    corpus = [{"_paper_key": "ss:slr1", "title": "X", "year": 2020, "venue": "v"}]
    rows = rank._compute_raw_dims(
        corpus=corpus,
        refs_by_slr={"ss:slr1": []},
        coverage_map={"ss:slr1": 0.5},
        metadata={},
        embeddings={},
        judge_map={"ss:slr1": {"score": None, "model": "x"}},
    )
    assert len(rows) == 1
    assert rows[0]["judge_justification"] is None


def test_run_empty_corpus_writes_csv_with_header(tmp_path):
    """Empty corpus must still emit a CSV with the header row (not a 0-byte file)."""
    import json
    pd = tmp_path / "processed"
    pd.mkdir()
    (pd / "slr_corpus.json").write_text("[]", encoding="utf-8")
    (pd / "slr_references.json").write_text("{}", encoding="utf-8")
    (pd / "overlap_matrix.csv").write_text("slr_id,coverage_pct\n", encoding="utf-8")
    (pd / "paper_metadata.json").write_text("{}", encoding="utf-8")
    np.savez(
        pd / "embeddings.npz",
        keys=np.array([]),
        vecs=np.zeros((0, 4), dtype=np.float32),
        embed_source=np.array([]),
        model=np.array("test"),
    )
    csv_out = tmp_path / "ranked.csv"
    json_out = tmp_path / "ranked.json"
    report_out = tmp_path / "report.md"
    rank.run(
        corpus_path=pd / "slr_corpus.json",
        refs_path=pd / "slr_references.json",
        overlap_path=pd / "overlap_matrix.csv",
        metadata_path=pd / "paper_metadata.json",
        embeddings_path=pd / "embeddings.npz",
        judge_path=pd / "missing_judge.json",
        csv_path=csv_out,
        json_path=json_out,
        report_path=report_out,
    )
    content = csv_out.read_text(encoding="utf-8")
    assert content.startswith("rank,slr_key,"), f"expected header, got: {content!r}"


def test_min_max_normalize_all_zero_returns_zero():
    """All-zero raw values mean 'no signal' — must return 0.0 each, not 0.5."""
    assert rank.min_max_normalize([0.0, 0.0, 0.0]) == [0.0, 0.0, 0.0]
    # Non-zero ties should still return 0.5 (genuine tie).
    assert rank.min_max_normalize([0.7, 0.7, 0.7]) == [0.5, 0.5, 0.5]
