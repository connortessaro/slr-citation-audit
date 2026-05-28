from lib.paperid import dedup_by_key, normalize_doi, normalize_title, paper_key


class TestNormalizeDoi:
    def test_strips_url_prefix(self):
        assert normalize_doi("https://doi.org/10.1109/X.2018.1") == "10.1109/x.2018.1"

    def test_strips_dx_prefix(self):
        assert normalize_doi("http://dx.doi.org/10.1109/X.2018.1") == "10.1109/x.2018.1"

    def test_strips_doi_scheme(self):
        assert normalize_doi("doi:10.1145/abc") == "10.1145/abc"

    def test_none_returns_none(self):
        assert normalize_doi(None) is None
        assert normalize_doi("") is None
        assert normalize_doi("   ") is None


class TestNormalizeTitle:
    def test_lowercases_and_strips_punctuation(self):
        assert normalize_title("A Systematic Literature Review!") == "asystematicliteraturereview"

    def test_handles_unicode(self):
        assert normalize_title("Café Survey") == "cafesurvey"

    def test_empty(self):
        assert normalize_title(None) == ""
        assert normalize_title("") == ""


class TestPaperKey:
    def test_prefers_doi(self):
        assert paper_key({"doi": "10.1/A", "paperId": "X", "title": "T"}) == "doi:10.1/a"

    def test_falls_back_to_paper_id(self):
        assert paper_key({"paperId": "X", "title": "T"}) == "ss:X"

    def test_falls_back_to_title(self):
        assert paper_key({"title": "Hello World"}) == "title:helloworld"

    def test_uses_external_ids_doi(self):
        assert paper_key({"externalIds": {"DOI": "10.1/Z"}, "title": "T"}) == "doi:10.1/z"

    def test_handles_none_external_ids(self):
        # Semantic Scholar returns externalIds=null when no IDs are present;
        # paper.get("externalIds", {}) would NOT default in that case.
        assert paper_key({"externalIds": None, "paperId": "X"}) == "ss:X"
        assert paper_key({"externalIds": None, "title": "Hello"}) == "title:hello"


class TestDedup:
    def test_dedup_removes_duplicates(self):
        papers = [
            {"doi": "10.1/A", "title": "First"},
            {"doi": "10.1/a", "title": "First (duplicate)"},
            {"doi": "10.1/B", "title": "Second"},
        ]
        out = dedup_by_key(papers)
        assert len(out) == 2
        assert out[0]["title"] == "First"
        assert out[1]["title"] == "Second"

    def test_dedup_preserves_order(self):
        papers = [{"title": f"P{i}"} for i in range(3)]
        assert [p["title"] for p in dedup_by_key(papers)] == ["P0", "P1", "P2"]
