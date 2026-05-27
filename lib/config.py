"""Load subfield configuration from config/subfield.yaml."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = REPO_ROOT / "config" / "subfield.yaml"
EXAMPLE_CONFIG_PATH = REPO_ROOT / "config" / "subfield.example.yaml"


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
    def from_yaml(cls, path: Path | None = None) -> "Config":
        path = path or CONFIG_PATH
        if not path.exists():
            if EXAMPLE_CONFIG_PATH.exists():
                path = EXAMPLE_CONFIG_PATH
            else:
                raise FileNotFoundError(f"No config at {CONFIG_PATH} or {EXAMPLE_CONFIG_PATH}")
        with path.open("r", encoding="utf-8") as f:
            raw: dict[str, Any] = yaml.safe_load(f)
        return cls(
            subfield=raw["subfield"],
            keywords=list(raw["keywords"]),
            year_min=int(raw["year_min"]),
            year_max=int(raw["year_max"]),
            slr_title_patterns=[p.lower() for p in raw["slr_title_patterns"]],
            top_n=int(raw.get("top_n", 50)),
            ss_base_url=raw.get("ss_base_url", "https://api.semanticscholar.org/graph/v1"),
            ss_api_key=os.environ.get("SEMANTIC_SCHOLAR_API_KEY"),
        )


def load() -> Config:
    return Config.from_yaml()
