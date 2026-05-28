"""Compatibility re-export for the shared core config.

New code should import from `core.config`.
"""

from core.config import CONFIG_PATH, EXAMPLE_CONFIG_PATH, REPO_ROOT, Config, load  # noqa: F401
