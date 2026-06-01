"""Embed each paper into a 1024-d vector via sentence-transformers (Qwen3-Embedding-0.6B by default).

Text-source priority per paper:
    1. full PDF text (if data/raw/fulltext/<key>.txt exists)        -> embed_source="fulltext"
    2. title + ". " + abstract (if abstract present)                -> embed_source="abstract"
    3. title only                                                   -> embed_source="title"

Inputs:
    data/processed/paper_metadata.json
    data/raw/fulltext/<safe_key>.txt
Outputs:
    data/processed/embeddings.npz   -- keys (str array), vecs (N, D float32),
                                       embed_source (str array), model (str)
"""
from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

import numpy as np
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lib.config import REPO_ROOT, load as load_config  # noqa: E402
from lib.paperid import safe_filename  # noqa: E402

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

METADATA_PATH = REPO_ROOT / "data" / "processed" / "paper_metadata.json"
FULLTEXT_DIR = REPO_ROOT / "data" / "raw" / "fulltext"
EMBEDDINGS_PATH = REPO_ROOT / "data" / "processed" / "embeddings.npz"

def _build_text(
    key: str,
    paper: dict,
    fulltext_dir: Path,
    max_chars: int,
) -> tuple[str, str]:
    """Return (text, source). source in {fulltext, abstract, title, none}."""
    title = (paper.get("title") or "").strip()
    abstract = (paper.get("abstract") or "").strip()
    fulltext_path = fulltext_dir / f"{safe_filename(key)}.txt"
    if fulltext_path.exists():
        text = fulltext_path.read_text(encoding="utf-8").strip()
        if not text:
            # Empty fulltext cache shouldn't masquerade as a fulltext-sourced embed.
            return (f"{title}. {abstract}".strip() if abstract else title, "abstract" if abstract else "title")
        combined = f"{title}\n\n{abstract}\n\n{text}".strip()
        # Truncate the COMBINED string so title+abstract overhead is included in the budget.
        if len(combined) > max_chars:
            combined = combined[:max_chars]
        return combined, "fulltext"
    if abstract:
        return f"{title}. {abstract}".strip(), "abstract"
    if title:
        return title, "title"
    return "", "none"


def _cache_is_current(path: Path, expected_keys: list[str], model_name: str) -> bool:
    if not path.exists():
        return False
    try:
        cache = np.load(path, allow_pickle=False)
        cached_model = str(cache["model"].item()) if "model" in cache.files else ""
        if cached_model != model_name:
            return False
        cached_keys = [str(k) for k in cache["keys"]]
        # Compare as sets + length so paper-set changes (not just ordering) force a re-embed.
        return len(cached_keys) == len(expected_keys) and set(cached_keys) == set(expected_keys)
    except Exception:  # noqa: BLE001
        return False


def run(
    metadata_path: Path = METADATA_PATH,
    fulltext_dir: Path = FULLTEXT_DIR,
    output_path: Path = EMBEDDINGS_PATH,
    force: bool = False,
) -> Path:
    if not metadata_path.exists():
        raise FileNotFoundError(f"Missing {metadata_path}. Run fetch.py first.")

    cfg = load_config()
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    keys = sorted(metadata.keys())

    if not force and _cache_is_current(output_path, keys, cfg.embed_model):
        logger.info("Embeddings cache current for %s; skipping encode", cfg.embed_model)
        return output_path

    # Approx 4 chars per token. Reserve a small margin.
    max_chars = max(1000, cfg.fulltext_max_tokens * 4 - 1000)

    texts: list[str] = []
    sources: list[str] = []
    for key in keys:
        text, src = _build_text(key, metadata[key], fulltext_dir, max_chars)
        texts.append(text or metadata[key].get("title") or key)
        sources.append(src)

    # Defer heavy import so module-level remains light for tests.
    from sentence_transformers import SentenceTransformer  # noqa: PLC0415

    logger.info("Loading embedding model: %s", cfg.embed_model)
    model = SentenceTransformer(cfg.embed_model)

    logger.info("Encoding %d papers (%d fulltext / %d abstract / %d title)",
                len(texts),
                sources.count("fulltext"), sources.count("abstract"), sources.count("title"))

    vecs = model.encode(
        texts,
        batch_size=16,
        normalize_embeddings=True,
        show_progress_bar=True,
        convert_to_numpy=True,
    ).astype(np.float32)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        output_path,
        keys=np.array(keys),               # auto-fixed unicode dtype, no pickle needed
        vecs=vecs,
        embed_source=np.array(sources),
        model=np.array(cfg.embed_model),
    )
    logger.info("Wrote %s (shape=%s)", output_path.relative_to(REPO_ROOT), vecs.shape)
    return output_path


def main() -> None:
    path = run()
    cache = np.load(path, allow_pickle=False)
    print(f"Embeddings: {cache['vecs'].shape} -> {path.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
