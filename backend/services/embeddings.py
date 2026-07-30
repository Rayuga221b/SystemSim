"""Embeddings provider — Gemini `gemini-embedding-001` via REST.

WHY a separate file from services/gemini.py: same isolation rule as every
other provider in this repo (gemini / groq) — embeddings are their own
dependency with their own model id, quota, and failure modes, and the
retrieval layer (services/rag.py) must be swappable to another embedding
provider (OpenAI, Voyage, local) without touching generation code.

WHY Gemini for embeddings when generation runs on Groq: Groq exposes no
embeddings endpoint, and the Gemini key is the real, quota-bearing key we
hold (DECISION 2026-07-28, docs/RAG.md). Provider choice for embeddings is
STICKY in a way generation is not: every stored vector is only comparable to
queries embedded by the same model, so swapping later means re-embedding the
whole corpus (cheap here — ~400 chunks — but the coupling is worth naming).

Dimensionality: 768 (not the model's native 3072). At our corpus size the
retrieval-quality delta is negligible and 768 quarters storage and dot-product
cost. Vectors at non-native dims are NOT pre-normalized by the API, so we
L2-normalize before storing/searching — cosine then reduces to a dot product.
"""
from __future__ import annotations

import json
import math
import os
import re
import time
import urllib.error
import urllib.request

EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "gemini-embedding-001")
EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", "768"))
API_ROOT = "https://generativelanguage.googleapis.com/v1beta"

# batchEmbedContents caps at 100 requests; stay well under it so one failed
# batch loses little work and the free-tier RPM budget spreads evenly.
BATCH_SIZE = 16


class AIUnavailable(Exception):
    """No key configured, or the provider rejected the request."""


def _key() -> str:
    # .strip(): guards against a trailing newline in a secret-manager-sourced
    # value — see services/groq.py's _key() for the incident this pattern
    # is copied from (a bare 500 in production from an unstripped key).
    k = os.getenv("GEMINI_API_KEY")
    if not k or not k.strip():
        raise AIUnavailable("Set GEMINI_API_KEY (backend/.env) to use embeddings.")
    return k.strip()


def _retry_delay(body: str, attempt: int) -> float:
    """Gemini 429 bodies carry a RetryInfo detail like {"retryDelay": "39s"} —
    honor it (the guess-based backoff was too short for the per-minute quota
    and burned all its retries inside one rate window)."""
    m = re.search(r'"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"', body)
    if m:
        return min(float(m.group(1)) + 1, 90)
    return min(2 ** attempt * 5, 60)


def _post(url: str, payload: dict, *, retries: int = 8) -> dict:
    data = json.dumps(payload).encode("utf-8")
    last = ""
    for attempt in range(retries):
        req = urllib.request.Request(
            url, data=data, headers={"Content-Type": "application/json"}, method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as r:  # noqa: S310
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")
            last = f"Embeddings HTTP {e.code}: {body[:300]}"
            if e.code in (429, 500, 503) and attempt < retries - 1:
                time.sleep(_retry_delay(body, attempt))
                continue
            raise AIUnavailable(last) from e
        except urllib.error.URLError as e:
            last = f"Embeddings network error: {e.reason}"
            if attempt < retries - 1:
                time.sleep(2 ** attempt * 3)
                continue
            raise AIUnavailable(last) from e
    raise AIUnavailable(last)


def _normalize(vec: list[float]) -> list[float]:
    norm = math.sqrt(sum(v * v for v in vec))
    if norm == 0:
        return vec
    return [v / norm for v in vec]


def embed_documents(texts: list[str]) -> list[list[float]]:
    """Embed corpus chunks (task type RETRIEVAL_DOCUMENT). Batched.

    Task types matter: Gemini trains asymmetric retrieval embeddings —
    documents and queries are projected differently so short questions still
    land near long passages. Using the wrong pair silently degrades recall.
    """
    out: list[list[float]] = []
    for i in range(0, len(texts), BATCH_SIZE):
        if i:  # pace batches — the free-tier quota is per-minute
            time.sleep(2)
        batch = texts[i:i + BATCH_SIZE]
        payload = {
            "requests": [
                {
                    "model": f"models/{EMBEDDING_MODEL}",
                    "content": {"parts": [{"text": t}]},
                    "taskType": "RETRIEVAL_DOCUMENT",
                    "outputDimensionality": EMBEDDING_DIM,
                }
                for t in batch
            ]
        }
        url = f"{API_ROOT}/models/{EMBEDDING_MODEL}:batchEmbedContents?key={_key()}"
        data = _post(url, payload)
        embeddings = data.get("embeddings", [])
        if len(embeddings) != len(batch):
            raise AIUnavailable(
                f"Embeddings count mismatch: sent {len(batch)}, got {len(embeddings)}"
            )
        out.extend(_normalize(e["values"]) for e in embeddings)
    return out


def embed_query(text: str) -> list[float]:
    """Embed a user question (task type RETRIEVAL_QUERY)."""
    url = f"{API_ROOT}/models/{EMBEDDING_MODEL}:embedContent?key={_key()}"
    payload = {
        "model": f"models/{EMBEDDING_MODEL}",
        "content": {"parts": [{"text": text}]},
        "taskType": "RETRIEVAL_QUERY",
        "outputDimensionality": EMBEDDING_DIM,
    }
    data = _post(url, payload)
    values = data.get("embedding", {}).get("values")
    if not values:
        raise AIUnavailable(f"Embeddings empty response: {json.dumps(data)[:200]}")
    return _normalize(values)
