from core.slr_labels import infer_study_type, matches_review_label

PATTERNS = [
    "systematic literature review",
    "literature review",
    "slr",
    "survey",
    "scoping review",
]


class TestMatchesReviewLabel:
    def test_systematic_phrase_in_title(self):
        assert matches_review_label(
            "A Systematic Literature Review of Technical Debt",
            None,
            PATTERNS,
        )

    def test_literature_review_without_systematic(self):
        assert matches_review_label(
            "Technical Debt: A Literature Review",
            None,
            PATTERNS,
        )

    def test_slr_as_token(self):
        assert matches_review_label("Tools for Technical Debt: An SLR", None, PATTERNS)

    def test_slr_not_substring_false_positive(self):
        assert not matches_review_label("Silver Technical Debt Metrics", None, ["slr"])

    def test_survey_in_abstract(self):
        assert matches_review_label(
            "Managing Technical Debt",
            "This paper presents a survey of the field.",
            PATTERNS,
        )

    def test_no_label(self):
        assert not matches_review_label(
            "Measuring Technical Debt in Microservices",
            "We conducted an empirical study.",
            PATTERNS,
        )


class TestInferStudyType:
    def test_sms(self):
        assert infer_study_type("A Systematic Mapping Study on Technical Debt") == "sms"

    def test_survey(self):
        assert infer_study_type("A Survey of Technical Debt Practices") == "survey"

    def test_default_slr(self):
        assert infer_study_type("Technical Debt: A Systematic Literature Review") == "slr"
