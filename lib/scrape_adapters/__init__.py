"""Per-publisher adapters for parsing SLR Appendix-B / Selected-Studies lists.

Crossref handles the bibliography for any DOI cleanly, but it does NOT
distinguish which references the SLR authors flagged as "primary studies"
vs background citations. Recovering that distinction means parsing the
publisher's own appendix HTML, which varies per publisher.

Each adapter implements `parse_appendix(page_md: str) -> list[PrimaryStudy]`
on a normalized markdown render of the article page.

Adapter dispatch happens by URL host (see `pick_adapter`).
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, asdict
from typing import Iterable
from urllib.parse import urlparse


@dataclass(frozen=True)
class PrimaryStudy:
    """One row of an Appendix-B / Selected-Studies table.

    Matches the project CSV schema used elsewhere (id, title, authors,
    year, venue, doi). Authors is a single string (full author list as
    rendered by the publisher, e.g. "A. Smith, B. Jones, C. Lee").
    """

    id: str
    title: str
    authors: str
    year: str
    venue: str
    doi: str

    def as_row(self) -> dict[str, str]:
        return asdict(self)


class BaseAdapter(ABC):
    """Contract every publisher adapter must satisfy."""

    #: Hostname this adapter handles, e.g. "www.sciencedirect.com".
    host: str

    @abstractmethod
    def parse_appendix(self, page_md: str) -> list[PrimaryStudy]:
        """Extract the selected-primary-studies list from a markdown page.

        Returns an empty list if no appendix is recognizable. Adapters
        MUST NOT raise on malformed pages -- the caller decides what to
        do with a zero-row result (skip, fall back to LLM, etc.).
        """


_REGISTRY: dict[str, BaseAdapter] = {}


def register(adapter: BaseAdapter) -> BaseAdapter:
    """Add an adapter to the host-keyed registry. Idempotent."""
    _REGISTRY[adapter.host] = adapter
    return adapter


def pick_adapter(url: str) -> BaseAdapter | None:
    """Return the adapter whose host matches the URL, or None."""
    host = (urlparse(url).hostname or "").lower()
    if not host:
        return None
    if host in _REGISTRY:
        return _REGISTRY[host]
    # Fallback: strip leading "www." for tolerant match
    bare = host.removeprefix("www.")
    return _REGISTRY.get(bare) or _REGISTRY.get(f"www.{bare}")


def registered_hosts() -> Iterable[str]:
    return tuple(_REGISTRY.keys())


# Eager-import known adapters so they self-register on `pick_adapter` call.
# Keep this list short -- one import per active publisher.
from . import elsevier  # noqa: E402, F401
