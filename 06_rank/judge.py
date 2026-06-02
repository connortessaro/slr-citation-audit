"""LLM-judge SLRs by citation quality via OpenRouter (DeepSeek V3 free by default).

For each SLR:
    1. Build a grounded prompt: SLR title + abstract (+ full text if available)
       + 30 closest references (title + abstract).
    2. Call OpenRouter via OpenAI-compatible SDK with response_format=RubricScore.
    3. Cache the parsed RubricScore JSON to data/raw/llm_judge/<safe_key>.json.

Re-runs hit cache and never re-call the API.

Inputs:
    data/processed/slr_corpus.json
    data/processed/slr_references.json
    data/processed/paper_metadata.json
Outputs:
    data/raw/llm_judge/<safe_key>.json   -- {model, response_id, score: RubricScore}
    data/processed/llm_judge_scores.json -- merged {slr_key: RubricScore}
"""
from __future__ import annotations

import json
import logging
import sys
import time
from pathlib import Path
from typing import Iterable

from pydantic import BaseModel, Field
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fetch import FULLTEXT_DIR  # noqa: E402
from lib.config import REPO_ROOT, load as load_config  # noqa: E402
from lib.paperid import paper_key, safe_filename  # noqa: E402

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

CORPUS_PATH = REPO_ROOT / "data" / "processed" / "slr_corpus.json"
REFS_PATH = REPO_ROOT / "data" / "processed" / "slr_references.json"
METADATA_PATH = REPO_ROOT / "data" / "processed" / "paper_metadata.json"
JUDGE_CACHE_DIR = REPO_ROOT / "data" / "raw" / "llm_judge"
JUDGE_SCORES_PATH = REPO_ROOT / "data" / "processed" / "llm_judge_scores.json"

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
_MAX_REFS_IN_PROMPT = 30
_REF_ABSTRACT_CHARS = 600
_SLR_FULLTEXT_CHARS = 60000  # ~15k tokens; leaves room for ref abstracts + system
_RUBRIC_DIMS = ("coverage", "recency", "diversity", "methodology", "comprehensiveness")


class RubricScore(BaseModel):
    """Structured rubric output. Each dim 1-5 (low to high)."""

    coverage: int = Field(ge=1, le=5, description="Cites the field's canonical and seminal papers")
    recency: int = Field(ge=1, le=5, description="Mixes seminal and recent (last ~3y) work appropriately")
    diversity: int = Field(ge=1, le=5, description="Cites across venues, authors, perspectives (not an echo chamber)")
    methodology: int = Field(ge=1, le=5, description="References support the SLR's stated method (protocol, RQs, synthesis)")
    comprehensiveness: int = Field(ge=1, le=5, description="Reference set covers the breadth claimed by the SLR's scope")
    justification: str = Field(min_length=20, description="2-4 sentence rationale for the scores")


SYSTEM_PROMPT = """You are an expert reviewer evaluating Systematic Literature Reviews (SLRs) by the quality of their citation choices.

Score the SLR on a 1-5 rubric across 5 dimensions. Each dimension:
- 1 = serious weakness (omits canonical work, off-topic refs, echo chamber, narrow)
- 3 = adequate
- 5 = excellent (cites canon, balances seminal+recent, diverse venues/authors, well-aligned with stated method, comprehensive)

Be strict and calibrated. Most SLRs are 3-4 on most dims; reserve 5 for genuinely strong work and 1-2 for clear weakness.
Provide a 2-4 sentence justification grounded in the references shown.
Return strictly the requested JSON schema. No extra commentary."""


def _build_user_prompt(slr: dict, slr_fulltext: str | None, refs: list[dict]) -> str:
    title = slr.get("title", "")
    year = slr.get("year", "")
    venue = slr.get("venue", "")
    abstract = slr.get("abstract", "") or ""
    parts = [
        f"# SLR\n\nTitle: {title}\nYear: {year}\nVenue: {venue}\n\nAbstract:\n{abstract}",
    ]
    if slr_fulltext:
        body = slr_fulltext[:_SLR_FULLTEXT_CHARS]
        parts.append(f"\nFull text (truncated):\n{body}")
    parts.append("\n# References\n")
    for i, ref in enumerate(refs[:_MAX_REFS_IN_PROMPT], start=1):
        rtitle = ref.get("title", "") or ""
        ryear = ref.get("year", "") or ""
        rvenue = ref.get("venue", "") or ""
        rabs = (ref.get("abstract") or "")[:_REF_ABSTRACT_CHARS]
        parts.append(f"[{i}] {rtitle} ({ryear}, {rvenue})\n    {rabs}")
    parts.append(
        "\n# Task\nScore the SLR on the 5 rubric dimensions. "
        "Return ONLY a JSON object matching the schema. No prose outside the JSON."
    )
    return "\n".join(parts)


def _enrich_refs(refs: list[dict], metadata: dict[str, dict]) -> list[dict]:
    """Attach abstract from the enriched metadata where available."""
    out = []
    for ref in refs:
        key = ref.get("paper_key") or paper_key(ref)
        enriched = metadata.get(key, {})
        merged = dict(ref)
        if not merged.get("abstract") and enriched.get("abstract"):
            merged["abstract"] = enriched["abstract"]
        out.append(merged)
    return out


def _load_fulltext(slr_key: str) -> str | None:
    path = FULLTEXT_DIR / f"{safe_filename(slr_key)}.txt"
    if path.exists():
        return path.read_text(encoding="utf-8")
    return None


def _call_openrouter(
    client,
    model_chain: Iterable[str],
    messages: list[dict],
    schema: type[BaseModel],
    max_retries: int = 3,
) -> tuple[RubricScore, dict]:
    """Try each model in the chain; retry on transient errors."""
    last_exc: Exception | None = None
    for model in model_chain:
        delay = 2.0
        for attempt in range(max_retries):
            try:
                resp = client.chat.completions.parse(
                    model=model,
                    messages=messages,
                    temperature=0,
                    response_format=schema,
                )
                msg = resp.choices[0].message
                parsed = msg.parsed
                if parsed is None:
                    raise ValueError("Response missing structured output")
                meta = {
                    "model": resp.model,
                    "response_id": resp.id,
                    "finish_reason": resp.choices[0].finish_reason,
                }
                return parsed, meta
            except Exception as exc:  # noqa: BLE001
                last_exc = exc
                logger.warning("LLM call failed (model=%s, attempt %d): %s", model, attempt + 1, exc)
                # Don't sleep after the last attempt -- move on to the next model immediately.
                if attempt < max_retries - 1:
                    time.sleep(delay)
                    delay *= 2
    raise RuntimeError(f"All judge models exhausted: {last_exc}")


def _judge_one(
    client,
    model_chain: list[str],
    slr_key: str,
    slr: dict,
    refs: list[dict],
) -> dict:
    """Cache-first judge for a single SLR. Returns the cached/fresh payload."""
    cache = JUDGE_CACHE_DIR / f"{safe_filename(slr_key)}.json"
    if cache.exists():
        try:
            return json.loads(cache.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            logger.warning("Corrupt judge cache at %s; regenerating", cache)

    fulltext = _load_fulltext(slr_key)
    user_prompt = _build_user_prompt(slr, fulltext, refs)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]
    score, meta = _call_openrouter(client, model_chain, messages, RubricScore)
    payload = {"score": score.model_dump(), **meta}

    JUDGE_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    return payload


def _build_client(api_key: str):
    """Import + construct openai client at call-time (lighter test surface)."""
    from openai import OpenAI  # noqa: PLC0415
    return OpenAI(base_url=OPENROUTER_BASE_URL, api_key=api_key)


def run(
    corpus_path: Path = CORPUS_PATH,
    refs_path: Path = REFS_PATH,
    metadata_path: Path = METADATA_PATH,
    output_path: Path = JUDGE_SCORES_PATH,
    client=None,
) -> dict[str, dict]:
    for p in (corpus_path, refs_path, metadata_path):
        if not p.exists():
            raise FileNotFoundError(f"Missing required input: {p}")

    cfg = load_config()
    if client is None:
        if not cfg.openrouter_api_key:
            raise RuntimeError("OPENROUTER_API_KEY not set in .env; can't run LLM judge.")
        client = _build_client(cfg.openrouter_api_key)

    model_chain = [cfg.llm_judge_model, *cfg.llm_judge_fallbacks]
    corpus = json.loads(corpus_path.read_text(encoding="utf-8"))
    refs_by_slr = json.loads(refs_path.read_text(encoding="utf-8"))
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))

    scores: dict[str, dict] = {}
    for slr in tqdm(corpus, desc="judge"):
        slr_key = slr.get("_paper_key") or paper_key(slr)
        refs = _enrich_refs(refs_by_slr.get(slr_key, []), metadata)
        try:
            payload = _judge_one(client, model_chain, slr_key, slr, refs)
        except Exception as exc:  # noqa: BLE001
            logger.error("Judge failed for %s: %s", slr_key, exc)
            continue
        scores[slr_key] = payload

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(scores, indent=2, sort_keys=True), encoding="utf-8")
    logger.info("Judged %d/%d SLRs -> %s", len(scores), len(corpus), output_path.relative_to(REPO_ROOT))
    return scores


def main() -> None:
    scores = run()
    print(f"LLM judge scored {len(scores)} SLRs")


if __name__ == "__main__":
    main()
