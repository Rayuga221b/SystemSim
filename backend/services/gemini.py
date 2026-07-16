"""Gemini provider — used ONLY by the roadmap ingest pipeline.

WHY separate from services/claude.py: the in-app AI features (explain/mentor)
stay on Claude (pinned in CLAUDE.md). The roadmap ingest is a one-time content
batch, and the key we have is for Gemini — so this provider is isolated here and
documented as a decision in BACKEND_LOG.md.

REST via urllib (no new SDK dependency). Model id lives in ONE place: the
GEMINI_MODEL env var (default below). Set GEMINI_API_KEY in backend/.env.
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
API_ROOT = "https://generativelanguage.googleapis.com/v1beta"


class AIUnavailable(Exception):
    """No key configured, or the provider rejected the request."""


def _key() -> str:
    k = os.getenv("GEMINI_API_KEY")
    if not k:
        raise AIUnavailable("Set GEMINI_API_KEY (backend/.env) to use Gemini.")
    return k


def _post(url: str, payload: dict, *, retries: int = 4) -> dict:
    """POST with backoff on transient overload (503/429) — important for a long
    batch where the model may briefly spike in demand."""
    data = json.dumps(payload).encode("utf-8")
    last = ""
    for attempt in range(retries):
        req = urllib.request.Request(
            url, data=data, headers={"Content-Type": "application/json"}, method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=180) as r:  # noqa: S310
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")
            last = f"Gemini HTTP {e.code}: {body[:300]}"
            if e.code in (429, 500, 503) and attempt < retries - 1:
                time.sleep(2 ** attempt * 3)  # 3s, 6s, 12s
                continue
            raise AIUnavailable(last) from e
    raise AIUnavailable(last)


def list_models() -> list[dict]:
    """Models available to this key that support generateContent."""
    url = f"{API_ROOT}/models?key={_key()}&pageSize=100"
    try:
        with urllib.request.urlopen(url, timeout=30) as r:  # noqa: S310
            data = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        raise AIUnavailable(f"Gemini HTTP {e.code}: {body[:400]}") from e
    return [
        {"name": m["name"].split("/")[-1],
         "display": m.get("displayName", ""),
         "input_token_limit": m.get("inputTokenLimit")}
        for m in data.get("models", [])
        if "generateContent" in m.get("supportedGenerationMethods", [])
    ]


def generate_json(system: str, user: str, *, model: str | None = None,
                  max_tokens: int = 8192, response_schema: dict | None = None) -> str:
    """One turn, returning the model's text as strict JSON.

    Passing `response_schema` uses Gemini's controlled generation, which
    GUARANTEES parseable JSON with properly escaped strings — essential when a
    field (body_md) is a large multi-line markdown blob that would otherwise
    come back with raw newlines and break json.loads."""
    model = model or GEMINI_MODEL
    url = f"{API_ROOT}/models/{model}:generateContent?key={_key()}"
    gen_config: dict = {
        "maxOutputTokens": max_tokens,
        "temperature": 0.7,
        "responseMimeType": "application/json",
    }
    if response_schema:
        gen_config["responseSchema"] = response_schema
    payload = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": gen_config,
    }
    data = _post(url, payload)

    candidates = data.get("candidates") or []
    if not candidates:
        raise AIUnavailable(f"Gemini returned no candidates: {json.dumps(data)[:300]}")
    cand = candidates[0]
    if cand.get("finishReason") == "SAFETY":
        raise AIUnavailable("Gemini blocked the response (SAFETY).")
    parts = cand.get("content", {}).get("parts", [])
    text = "".join(p.get("text", "") for p in parts).strip()
    if not text:
        raise AIUnavailable(f"Gemini empty text (finishReason={cand.get('finishReason')}).")
    return text
