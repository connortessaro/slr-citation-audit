"""Load pipeline configuration from .env (with .env.example as fallback)."""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import dotenv_values

logger = logging.getLogger(__name__)

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
    # Ranking stage (06_rank) defaults
    "LLM_JUDGE_MODEL": "deepseek/deepseek-chat:free",
    "LLM_JUDGE_FALLBACKS": "meta-llama/llama-3.3-70b-instruct:free,openai/gpt-oss-120b:free",
    "EMBED_MODEL": "Qwen/Qwen3-Embedding-0.6B",
    "RANK_WEIGHTS": "0.2,0.2,0.2,0.2,0.2",
    "FULLTEXT_ENABLED": "true",
    "FULLTEXT_MAX_TOKENS": "32000",
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
    # Ranking stage
    openrouter_api_key: str | None = None
    llm_judge_model: str = "deepseek/deepseek-chat:free"
    llm_judge_fallbacks: tuple[str, ...] = ()
    embed_model: str = "Qwen/Qwen3-Embedding-0.6B"
    rank_weights: tuple[float, ...] = (0.2, 0.2, 0.2, 0.2, 0.2)
    fulltext_enabled: bool = True
    fulltext_max_tokens: int = 32000

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
            # Precedence: explicit env > .env file > .env.example > _DEFAULTS.
            # An explicitly-set empty string at any level wins over later layers
            # so users can unset a default by writing `NAME=` in .env.
            if name in os.environ:
                return os.environ[name]
            if name in file_values:
                return file_values[name] or ""
            return _DEFAULTS.get(name, "")

        def get_int(name: str) -> int:
            # Empty/blank override falls through to _DEFAULTS so users don't have
            # to know the numeric default to keep one. Booleans/strings honor empty
            # via `get(...)` directly.
            raw = get(name)
            return int(raw) if raw.strip() else int(_DEFAULTS[name])

        raw_weights = _csv(get("RANK_WEIGHTS"))
        weights = tuple(float(x) for x in raw_weights)
        if len(weights) != 5:
            logger.warning(
                "RANK_WEIGHTS has %d values (need 5); resetting to equal weights (0.2 each). Got: %r",
                len(weights), raw_weights,
            )
            weights = (0.2, 0.2, 0.2, 0.2, 0.2)

        return cls(
            subfield=get("SUBFIELD"),
            keywords=_csv(get("KEYWORDS")),
            year_min=get_int("YEAR_MIN"),
            year_max=get_int("YEAR_MAX"),
            slr_title_patterns=[p.lower() for p in _csv(get("SLR_TITLE_PATTERNS"))],
            top_n=get_int("TOP_N"),
            ss_base_url=get("SS_BASE_URL"),
            ss_api_key=get("SEMANTIC_SCHOLAR_API_KEY") or None,
            openrouter_api_key=get("OPENROUTER_API_KEY") or None,
            llm_judge_model=get("LLM_JUDGE_MODEL"),
            llm_judge_fallbacks=tuple(_csv(get("LLM_JUDGE_FALLBACKS"))),
            embed_model=get("EMBED_MODEL"),
            rank_weights=weights,
            fulltext_enabled=get("FULLTEXT_ENABLED").lower() in ("1", "true", "yes"),
            fulltext_max_tokens=get_int("FULLTEXT_MAX_TOKENS"),
        )


def _csv(raw: str) -> list[str]:
    return [item.strip() for item in raw.split(",") if item.strip()]


def load() -> Config:
    return Config.from_env()
