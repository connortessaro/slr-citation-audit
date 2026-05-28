from pathlib import Path

import pytest

from lib.config import Config


@pytest.fixture
def clean_env(monkeypatch: pytest.MonkeyPatch):
    """Clear pipeline config env vars so Config falls back to .env/.env.example/_DEFAULTS."""
    for key in (
        "SUBFIELD", "KEYWORDS", "YEAR_MIN", "YEAR_MAX", "SLR_TITLE_PATTERNS",
        "TOP_N", "SS_BASE_URL", "SEMANTIC_SCHOLAR_API_KEY",
    ):
        monkeypatch.delenv(key, raising=False)


class TestConfigFromEnv:
    def test_uses_defaults_when_no_env_or_files(self, tmp_path: Path, clean_env: None):
        cfg = Config.from_env(env_path=tmp_path / "missing.env", example_path=tmp_path / "missing.example")
        assert cfg.subfield == "technical_debt"
        assert "technical debt" in cfg.keywords
        assert cfg.year_min == 2000
        assert cfg.year_max == 2025
        assert cfg.top_n == 50
        assert cfg.ss_api_key is None
        assert all(p == p.lower() for p in cfg.slr_title_patterns)

    def test_env_overrides_defaults(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, clean_env: None):
        env_file = tmp_path / ".env"
        env_file.write_text(
            "SUBFIELD=microservices\n"
            "KEYWORDS=microservices,service mesh\n"
            "YEAR_MIN=2010\n"
            "YEAR_MAX=2024\n"
            "TOP_N=25\n"
            "SEMANTIC_SCHOLAR_API_KEY=test-key-xyz\n",
            encoding="utf-8",
        )
        cfg = Config.from_env(env_path=env_file, example_path=tmp_path / "absent.example")
        assert cfg.subfield == "microservices"
        assert cfg.keywords == ["microservices", "service mesh"]
        assert cfg.year_min == 2010
        assert cfg.year_max == 2024
        assert cfg.top_n == 25
        assert cfg.ss_api_key == "test-key-xyz"

    def test_example_file_fills_gaps(self, tmp_path: Path, clean_env: None):
        example = tmp_path / ".env.example"
        example.write_text("SUBFIELD=tech_debt_v2\nKEYWORDS=a,b,c\n", encoding="utf-8")
        cfg = Config.from_env(env_path=tmp_path / "absent.env", example_path=example)
        assert cfg.subfield == "tech_debt_v2"
        assert cfg.keywords == ["a", "b", "c"]
        # Unspecified values fall back to module defaults.
        assert cfg.year_min == 2000

    def test_lowercases_slr_patterns(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, clean_env: None):
        env_file = tmp_path / ".env"
        env_file.write_text("SLR_TITLE_PATTERNS=Systematic Review,Mapping Study\n", encoding="utf-8")
        cfg = Config.from_env(env_path=env_file, example_path=tmp_path / "absent.example")
        assert cfg.slr_title_patterns == ["systematic review", "mapping study"]
