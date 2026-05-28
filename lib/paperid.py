"""Compatibility re-export for the shared core paper-id utilities.

New code should import from `core.paperid`.
"""

from core.paperid import dedup_by_key, normalize_doi, normalize_title, paper_key  # noqa: F401
