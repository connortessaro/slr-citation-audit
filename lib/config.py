"""Load pipeline configuration from .env (with .env.example as fallback)."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import dotenv_values

REPO_ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = REPO_ROOT / ".env"
EXAMPLE_ENV_PATH = REPO_ROOT / ".env.example"

# Defaults used when neither .env nor .env.example provide a value. These
# match the values shipped in .env.example.
_DEFAULTS = {
    "SUBFIELD": "technical_debt",
    "KEYWORDS": "technical debt,code debt,design debt,architectural debt",
    "YEAR_MIN": "2000",
    "YEAR_MAX": "2025",
    "SLR_TITLE_PATTERNS": "systematic literature review,systematic review,systematic mapping",
    "TOP_N": "50",
    "SS_BASE_URL": "https://api.semanticscholar.org/graph/v1",
}


@dataclass(frozen=True)
class Config:
    subfield: str
    keywords: list[str]
    year_min: int
    year_max: int
    slr_title_patterns: list[str]
    top_n: int
    ss_base_url: str
    ss_api_key: str | None

    @classmethod
    def from_env(cls, env_path: Path | None = None, example_path: Path | None = None) -> "Config":
        if env_path is None:
            env_path = ENV_PATH
        if example_path is None:
            example_path = EXAMPLE_ENV_PATH
        # Precedence: process env > .env > .env.example > _DEFAULTS.
        # `dotenv_values` reads file values into a dict without mutating os.environ.
        file_values: dict[str, str | None] = {}
        if example_path.exists():
            file_values.update(dotenv_values(example_path))
        if env_path.exists():
            file_values.update(dotenv_values(env_path))

        def get(name: str) -> str:
            return (
                os.environ.get(name)
                or (file_values.get(name) or "")
                or _DEFAULTS.get(name, "")
            )

        return cls(
            subfield=get("SUBFIELD"),
            keywords=_csv(get("KEYWORDS")),
            year_min=int(get("YEAR_MIN")),
            year_max=int(get("YEAR_MAX")),
            slr_title_patterns=[p.lower() for p in _csv(get("SLR_TITLE_PATTERNS"))],
            top_n=int(get("TOP_N")),
            ss_base_url=get("SS_BASE_URL"),
            ss_api_key=get("SEMANTIC_SCHOLAR_API_KEY") or None,
        )


def _csv(raw: str) -> list[str]:
    return [item.strip() for item in raw.split(",") if item.strip()]


def load() -> Config:
    return Config.from_env()
