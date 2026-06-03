"""Render a publisher article page to markdown via Playwright (cache-first).

ScienceDirect / IEEE / Springer SPAs require a real browser. Playwright is
free, in-tree, and avoids Firecrawl's 500/month quota. Pages are cached on
disk so re-runs hit local storage instead of the network.

Markdown conversion uses `html2text` so the output schema matches what the
existing Lenarduzzi one-off parser was tuned against.

Usage:
    from lib.page_fetcher import fetch_page_markdown

    md = fetch_page_markdown(
        "https://www.sciencedirect.com/science/article/pii/S016412122030220X",
        cache_path=Path("data/raw/scrape/<slug>/page.md"),
    )
"""
from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger(__name__)

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
)
DEFAULT_WAIT_SELECTOR = "main"
DEFAULT_TIMEOUT_MS = 30_000


def _html_to_markdown(html: str) -> str:
    """Convert article HTML to markdown using html2text with article-friendly settings."""
    import html2text  # imported lazily so tests/users without it can still parse cached files

    converter = html2text.HTML2Text()
    converter.body_width = 0  # no hard-wrap; preserves long titles
    converter.ignore_images = True
    converter.ignore_emphasis = False
    converter.protect_links = True
    return converter.handle(html)


def fetch_page_markdown(
    url: str,
    cache_path: Path,
    *,
    refresh: bool = False,
    wait_selector: str = DEFAULT_WAIT_SELECTOR,
    timeout_ms: int = DEFAULT_TIMEOUT_MS,
    user_agent: str = DEFAULT_USER_AGENT,
) -> str:
    """Return the article page as markdown, caching to `cache_path`.

    On first call: launches headless Chromium, navigates to `url`, waits
    for `wait_selector`, then dumps the rendered HTML through html2text.
    On subsequent calls: reads the cached markdown unless `refresh=True`.

    Raises RuntimeError if Playwright or its browser binaries are missing,
    with an install hint. Networking errors propagate from Playwright.
    """
    if cache_path.exists() and not refresh:
        logger.info("Reusing cached page markdown at %s", cache_path)
        return cache_path.read_text(encoding="utf-8")

    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:  # pragma: no cover -- import-time guard
        raise RuntimeError(
            "Playwright is not installed. Run: pip install playwright && playwright install chromium"
        ) from exc

    logger.info("Fetching %s via Playwright", url)
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(user_agent=user_agent)
            page = context.new_page()
            page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
            try:
                page.wait_for_selector(wait_selector, timeout=timeout_ms)
            except Exception:
                logger.warning("Selector %s did not appear; continuing with what loaded", wait_selector)
            html = page.content()
            browser.close()
    except Exception as exc:
        # Surface a friendlier error for the common case of missing browser binaries.
        if "Executable doesn't exist" in str(exc):
            raise RuntimeError(
                "Chromium browser binary missing. Run: playwright install chromium"
            ) from exc
        raise

    md = _html_to_markdown(html)
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(md, encoding="utf-8")
    logger.info("Wrote %d bytes of markdown to %s", len(md), cache_path)
    return md
