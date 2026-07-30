"""Groq provider — simulation explainer, roadmap ingest, and mentor/chat
generation.

WHY separate from services/gemini.py: providers stay isolated so a swap
touches nothing else. DECISION (2026-07-26): both Gemini features moved
here — the explainer runs on `llama-3.3-70b-versatile`, the roadmap ingest
on `qwen/qwen3.6-27b` — because the Groq key is the one with usable quota.
DECISION (2026-07-30, Satyam's call): Anthropic dropped entirely — no task
uses Claude anymore. The mentor/chat generation core (`services/mentor.py`,
previously Claude-preferred/Groq-fallback) now runs on Groq too, via its own
`GROQ_MENTOR_MODEL` so it can be tuned independently of the explainer's
model without touching that feature. `services/claude.py` deleted (no
importers left). Logged in CLAUDE.md / BACKEND_LOG.md.

OpenAI-compatible REST via urllib (no new SDK dependency). Model ids live in
ONE place: GROQ_MODEL / GROQ_INGEST_MODEL / GROQ_MENTOR_MODEL env vars
(defaults below — GROQ_MENTOR_MODEL defaults to GROQ_MODEL until deliberately
tuned to something else). Set GROQ_API_KEY in backend/.env.

JSON handling: Groq's schema-enforced structured outputs only cover the
GPT-OSS models, so for these models we use JSON *object* mode
(`response_format: {"type": "json_object"}` — guarantees syntactically valid
JSON) and inject the schema into the system prompt; callers keep validating
shape, same contract as before.
"""
from __future__ import annotations

import copy
import json
import os
import re
import time
import urllib.error
import urllib.request

GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_INGEST_MODEL = os.getenv("GROQ_INGEST_MODEL", "qwen/qwen3.6-27b")
# Mentor/chat generation (services/mentor.py). Defaults to GROQ_MODEL so it
# works out of the box; set GROQ_MENTOR_MODEL to a distinct model id once
# you've checked what's available on your key (`services.groq.list_models()`)
# — long-form grounded answers with citations benefit from a larger model
# than the explainer's short structured-JSON output needs.
GROQ_MENTOR_MODEL = os.getenv("GROQ_MENTOR_MODEL", GROQ_MODEL)
API_ROOT = "https://api.groq.com/openai/v1"


class AIUnavailable(Exception):
    """No key configured, or the provider rejected the request."""


def _key() -> str:
    k = os.getenv("GROQ_API_KEY")
    if not k:
        raise AIUnavailable("Set GROQ_API_KEY (backend/.env) to use Groq.")
    return k


def _post(payload: dict, *, retries: int = 5) -> dict:
    """POST with backoff. Groq free tier rate-limits per minute AND per day;
    a 429 carries a `retry-after` header in seconds — honor it (a long ingest
    batch routinely brushes the per-minute token cap)."""
    data = json.dumps(payload).encode("utf-8")
    url = f"{API_ROOT}/chat/completions"
    last = ""
    for attempt in range(retries):
        req = urllib.request.Request(
            url, data=data, method="POST",
            # Explicit User-Agent: Cloudflare fronts api.groq.com and rejects
            # urllib's default "Python-urllib/x.y" signature with a 403 (1010).
            headers={"Content-Type": "application/json",
                     "Authorization": f"Bearer {_key()}",
                     "User-Agent": "SystemSim/1.0"},
        )
        try:
            with urllib.request.urlopen(req, timeout=180) as r:  # noqa: S310
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")
            last = f"Groq HTTP {e.code}: {body[:300]}"
            if e.code in (429, 500, 502, 503) and attempt < retries - 1:
                retry_after = e.headers.get("retry-after")
                wait = float(retry_after) if retry_after else 2 ** attempt * 3
                time.sleep(min(wait, 120) + 1)
                continue
            raise AIUnavailable(last) from e
    raise AIUnavailable(last)


def list_models() -> list[str]:
    """Model ids available to this key."""
    req = urllib.request.Request(
        f"{API_ROOT}/models",
        headers={"Authorization": f"Bearer {_key()}",
                 "User-Agent": "SystemSim/1.0"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:  # noqa: S310
            data = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        raise AIUnavailable(f"Groq HTTP {e.code}: {body[:400]}") from e
    return sorted(m["id"] for m in data.get("data", []))


def _strip_gemini_keys(schema: dict) -> dict:
    """Drop Gemini-only `propertyOrdering` keys so the same schema dicts the
    callers already define work verbatim as standard JSON Schema in the prompt."""
    schema = copy.deepcopy(schema)

    def walk(node):
        if isinstance(node, dict):
            node.pop("propertyOrdering", None)
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    walk(schema)
    return schema


def generate_text(system: str, user: str, *, model: str | None = None,
                  max_tokens: int = 1024) -> str:
    """One turn of plain prose (no JSON mode). Used by the mentor fallback,
    where the answer is free text and the response envelope (sources etc.) is
    assembled server-side from retrieval metadata — never parsed from the
    model, so there's nothing for JSON mode to protect."""
    payload = {
        "model": model or GROQ_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "max_completion_tokens": max_tokens,
        "temperature": 0.6,
    }
    data = _post(payload)
    choices = data.get("choices") or []
    if not choices:
        raise AIUnavailable(f"Groq returned no choices: {json.dumps(data)[:300]}")
    text = (choices[0].get("message", {}).get("content") or "").strip()
    if not text:
        raise AIUnavailable(
            f"Groq empty content (finish_reason={choices[0].get('finish_reason')})."
        )
    return text


def generate_json(system: str, user: str, *, model: str | None = None,
                  max_tokens: int = 8192, response_schema: dict | None = None,
                  reasoning_effort: str | None = None) -> str:
    """One turn, returning the model's text as JSON.

    Same signature as gemini.generate_json, so swapping a feature between
    providers stays a one-import change. JSON object mode guarantees the text
    parses; the schema (injected into the prompt) steers the shape and the
    caller's validation stays the backstop.
    """
    model = model or GROQ_MODEL
    if response_schema:
        system = (
            f"{system}\n\nRespond with a single JSON object that conforms "
            f"EXACTLY to this JSON Schema (all required keys, no extras):\n"
            f"{json.dumps(_strip_gemini_keys(response_schema))}"
        )
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "max_completion_tokens": max_tokens,
        "temperature": 0.7,
        "response_format": {"type": "json_object"},
    }
    # Reasoning models (qwen) burn completion tokens on thinking before the
    # JSON; "none" turns that off. Only sent when asked — non-reasoning
    # models (llama) reject the parameter.
    if reasoning_effort:
        payload["reasoning_effort"] = reasoning_effort
    data = _post(payload)

    choices = data.get("choices") or []
    if not choices:
        raise AIUnavailable(f"Groq returned no choices: {json.dumps(data)[:300]}")
    choice = choices[0]
    text = (choice.get("message", {}).get("content") or "").strip()
    # Reasoning models (qwen) may prefix thinking despite JSON mode.
    text = re.sub(r"^<think>.*?</think>\s*", "", text, flags=re.DOTALL).strip()
    if not text:
        raise AIUnavailable(
            f"Groq empty content (finish_reason={choice.get('finish_reason')})."
        )
    if choice.get("finish_reason") == "length":
        raise AIUnavailable("Groq response truncated at max_completion_tokens.")
    return text
