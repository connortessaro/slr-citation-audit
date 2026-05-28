"""Shared helpers for database-first pipeline entrypoints."""

from __future__ import annotations

from pathlib import Path
from typing import Iterable


def ensure_pythonpath_hint() -> None:
    """Best-effort hint when users forget PYTHONPATH=."""
    # We avoid importing project modules here because the common failure mode is
    # that imports don't resolve until PYTHONPATH is set.
    return


def rel(p: Path, repo_root: Path) -> str:
    try:
        return str(p.relative_to(repo_root))
    except Exception:
        return str(p)


def print_steps(title: str, steps: Iterable[str]) -> None:
    print(title)
    for s in steps:
        print(f"  - {s}")

