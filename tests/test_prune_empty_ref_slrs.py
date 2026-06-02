import csv
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "02_extract_refs"))
import prune_empty_ref_slrs as prune  # noqa: E402

from lib.paperid import paper_key  # noqa: E402
from lib.slr_refs import filter_corpus_with_refs  # noqa: E402


def _slr(key: str, year: int = 2020) -> dict:
    return {"_paper_key": key, "title": f"SLR {key}", "year": year}


def _ref(key: str) -> dict:
    return {"paper_key": key, "title": f"Ref {key}"}


class TestFilterCorpusWithRefs:
    def test_splits_by_reference_count(self):
        corpus = [_slr("a"), _slr("b"), _slr("c")]
        refs = {"a": [_ref("r1")], "b": [], "c": [_ref("r2"), _ref("r3")]}
        included, excluded = filter_corpus_with_refs(corpus, refs)
        assert [s["_paper_key"] for s in included] == ["a", "c"]
        assert [s["_paper_key"] for s in excluded] == ["b"]


class TestPruneRun:
    def test_writes_filtered_corpus_and_updates_decisions(self, tmp_path: Path):
        corpus_path = tmp_path / "corpus.json"
        refs_path = tmp_path / "refs.json"
        decisions_path = tmp_path / "decisions.csv"

        corpus_path.write_text(json.dumps([_slr("keep"), _slr("drop")]))
        refs_path.write_text(json.dumps({"keep": [_ref("r1")], "drop": []}))
        with decisions_path.open("w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=[
                    "paper_key", "title", "year", "venue", "source",
                    "verdict", "reason", "type", "override_verdict",
                ],
            )
            writer.writeheader()
            writer.writerow({
                "paper_key": "keep", "title": "Keep", "year": 2020, "venue": "",
                "source": "ss", "verdict": "INCLUDE", "reason": "ok", "type": "slr",
                "override_verdict": "",
            })
            writer.writerow({
                "paper_key": "drop", "title": "Drop", "year": 2021, "venue": "",
                "source": "ss", "verdict": "INCLUDE", "reason": "ok", "type": "slr",
                "override_verdict": "",
            })

        stats = prune.run(
            source="ss",
            corpus_path=corpus_path,
            refs_path=refs_path,
            decisions_path=decisions_path,
        )
        assert stats == {"corpus_before": 2, "corpus_after": 1, "excluded": 1, "decisions_updated": 1}

        kept = json.loads(corpus_path.read_text())
        assert len(kept) == 1
        assert kept[0]["_paper_key"] == "keep"

        with decisions_path.open(encoding="utf-8") as f:
            rows = {r["paper_key"]: r for r in csv.DictReader(f)}
        assert rows["keep"]["verdict"] == "INCLUDE"
        assert rows["drop"]["verdict"] == "EXCLUDE"
        assert "no reference list" in rows["drop"]["reason"]
