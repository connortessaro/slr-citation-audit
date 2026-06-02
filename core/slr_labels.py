"""Match secondary-study self-labels in paper titles and abstracts."""

from __future__ import annotations

# Matched as whole tokens (padded) to avoid substring false positives, e.g. "slr" in unrelated words.
_SHORT_TOKENS = frozenset({"slr", "slrs"})


def matches_review_label(title: str | None, abstract: str | None, patterns: list[str]) -> bool:
    """True if any configured pattern appears in title or abstract."""
    title_l = (title or "").lower()
    abstract_l = (abstract or "").lower()
    for pattern in patterns:
        p = pattern.lower().strip()
        if not p:
            continue
        if p in _SHORT_TOKENS:
            if _token_present(p, title_l) or _token_present(p, abstract_l):
                return True
        elif p in title_l or p in abstract_l:
            return True
    return False


def _token_present(token: str, text: str) -> bool:
    padded = f" {text} "
    return f" {token} " in padded or f"({token})" in text or f"({token}s)" in text


def infer_study_type(title: str | None) -> str:
    """Coarse type for included secondary studies (stored as ``_classification_type``)."""
    t = (title or "").lower()
    if "systematic mapping" in t or "mapping study" in t:
        return "sms"
    if "scoping" in t:
        return "scoping"
    if "tertiary" in t:
        return "tertiary"
    if "survey" in t and "systematic" not in t:
        return "survey"
    if "meta-analysis" in t or "meta analysis" in t:
        return "meta-analysis"
    return "slr"
