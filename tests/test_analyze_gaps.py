import csv
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "05_explain_gaps"))
import analyze_gaps as ag  # noqa: E402


class TestClassifyVenue:
    def test_workshop_from_venue(self):
        assert ag.classify_venue({"venue": "First Workshop on Debt"}) == "workshop"

    def test_workshop_from_title(self):
        assert ag.classify_venue({"venue": "Proceedings", "title": "A Workshop Paper"}) == "workshop"

    def test_journal_from_pub_types(self):
        assert ag.classify_venue({"publicationTypes": ["JournalArticle"]}) == "journal"

    def test_conference_from_pub_types(self):
        assert ag.classify_venue({"publicationTypes": ["Conference"]}) == "conference"

    def test_journal_from_venue_string(self):
        assert ag.classify_venue({"venue": "IEEE Transactions on SE"}) == "journal"

    def test_conference_from_venue_string(self):
        assert ag.classify_venue({"venue": "International Conference on SE"}) == "conference"

    def test_preprint(self):
        assert ag.classify_venue({"venue": "arXiv.org"}) == "preprint"

    def test_unknown_fallback(self):
        assert ag.classify_venue({"venue": "Mystery Pub"}) == "unknown"


class TestOpenAccess:
    def test_dict_with_url(self):
        assert ag.open_access_flag({"openAccessPdf": {"url": "http://x"}}) is True

    def test_dict_without_url(self):
        assert ag.open_access_flag({"openAccessPdf": {}}) is False

    def test_none(self):
        assert ag.open_access_flag({"openAccessPdf": None}) is False


class TestDoiBlock:
    def test_acm_prefix(self):
        assert ag.doi_block({"doi": "10.1145/abc"}) == (True, False)

    def test_ieee_prefix(self):
        assert ag.doi_block({"doi": "10.1109/X"}) == (False, True)

    def test_other_prefix(self):
        assert ag.doi_block({"doi": "10.1007/Z"}) == (False, False)


class TestAgeBucket:
    def test_buckets(self):
        assert ag.age_bucket(0) == "0-2y"
        assert ag.age_bucket(2) == "0-2y"
        assert ag.age_bucket(3) == "3-5y"
        assert ag.age_bucket(5) == "3-5y"
        assert ag.age_bucket(7) == "6-10y"
        assert ag.age_bucket(11) == "10y+"
        assert ag.age_bucket(-1) == "post-slr"
        assert ag.age_bucket(None) == "unknown"


class TestEnrich:
    def test_attaches_features(self):
        missed = [{
            "slr_id": "slr1", "slr_year": "2018",
            "missed_paper_key": "p1", "missed_title": "X", "missed_year": "2010",
            "missed_venue": "ICSE", "missed_citation_count": "100", "missed_rank": "3",
        }]
        top_cited = [{
            "_paper_key": "p1", "title": "X", "year": 2010,
            "venue": "International Conference on Software Engineering",
            "publicationTypes": ["Conference"],
            "openAccessPdf": {"url": "http://x.pdf"},
            "doi": "10.1109/ICSE.2010.1",
            "_rank": 3,
        }]
        out = ag.enrich(missed, top_cited)
        row = out[0]
        assert row["venue_type"] == "conference"
        assert row["year_delta"] == 8
        assert row["age_bucket"] == "6-10y"
        assert row["open_access"] is True
        assert row["in_ieee"] is True
        assert row["in_acm"] is False
        assert row["is_top10"] is True


class TestRun:
    def test_end_to_end(self, tmp_path: Path):
        missed_path = tmp_path / "missed.csv"
        top_path = tmp_path / "top.json"
        out_path = tmp_path / "gap.csv"
        venue_path = tmp_path / "venue.csv"
        age_path = tmp_path / "age.csv"

        with missed_path.open("w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=[
                "slr_id", "slr_year", "missed_paper_key", "missed_title",
                "missed_year", "missed_venue", "missed_citation_count", "missed_rank",
            ])
            writer.writeheader()
            writer.writerow({
                "slr_id": "slr1", "slr_year": "2018",
                "missed_paper_key": "p1", "missed_title": "X", "missed_year": "2010",
                "missed_venue": "ICSE", "missed_citation_count": "100", "missed_rank": "3",
            })
            writer.writerow({
                "slr_id": "slr1", "slr_year": "2018",
                "missed_paper_key": "p2", "missed_title": "Y", "missed_year": "2015",
                "missed_venue": "Workshop on Debt", "missed_citation_count": "50", "missed_rank": "12",
            })
        top_path.write_text(json.dumps([
            {"_paper_key": "p1", "title": "X", "year": 2010, "venue": "ICSE",
             "publicationTypes": ["Conference"], "doi": "10.1109/ICSE.2010.1", "_rank": 3},
            {"_paper_key": "p2", "title": "Y", "year": 2015, "venue": "Workshop on Debt",
             "publicationTypes": [], "doi": "10.1145/W.2015.1", "_rank": 12},
        ]))

        ag.run(missed_path, top_path, out_path, venue_path, age_path)

        with out_path.open() as f:
            rows = list(csv.DictReader(f))
        assert len(rows) == 2
        by_id = {r["missed_paper_key"]: r for r in rows}
        assert by_id["p1"]["venue_type"] == "conference"
        assert by_id["p2"]["venue_type"] == "workshop"
        assert by_id["p1"]["is_top10"] == "True"
        assert by_id["p2"]["is_top10"] == "False"

        with venue_path.open() as f:
            venues = list(csv.DictReader(f))
        assert {v["venue_type"] for v in venues} == {"conference", "workshop"}
