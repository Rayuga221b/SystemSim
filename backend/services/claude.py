"""Single place that talks to the Claude API. Model id lives here only.

Both features are context-scoped by design (project decision): every prompt
carries the concrete graph/result or case-study content, never open-ended
chat. Keeps answers relevant and token cost predictable.

No ANTHROPIC_API_KEY -> AIUnavailable, which routes turn into a 503 the
frontend renders as a friendly "not configured" note. The product degrades
gracefully; nothing else depends on the key.
"""
from __future__ import annotations

import json
import os
from typing import Any

# One source of truth for the model. Spec pins this; a newer Sonnet
# (claude-sonnet-4-6) exists as of 2026 — change here (or via env) when ready.
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-20250514")
MAX_TOKENS = 700


class AIUnavailable(Exception):
    """Raised when AI features are called without an API key configured."""


def _client():
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise AIUnavailable("AI features require ANTHROPIC_API_KEY")
    from anthropic import Anthropic
    return Anthropic(api_key=api_key)


def _ask(system: str, user: str) -> str:
    message = _client().messages.create(
        model=CLAUDE_MODEL,
        max_tokens=MAX_TOKENS,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return "".join(block.text for block in message.content if block.type == "text")


# Public alias for cross-service callers (services/mentor.py builds its own
# prompt and only needs the transport). Internal helpers keep using _ask.
ask = _ask


def explain_simulation(graph: dict[str, Any], result: dict[str, Any]) -> str:
    """Explain WHY the sim result looks the way it does + one concrete fix."""
    system = (
        "You are a pragmatic distributed-systems mentor inside SystemSim, a "
        "system-design simulator. The user just simulated the architecture "
        "below. Explain in plain language WHY the bottlenecks/warnings happen "
        "(reference nodes by their labels), then give exactly ONE concrete, "
        "highest-impact fix based on this specific diagram. Under 200 words, "
        "no headers, no bullet spam — talk like a helpful senior engineer."
    )
    user = (
        f"ARCHITECTURE (nodes + edges):\n{json.dumps(graph, default=str)}\n\n"
        f"SIMULATION RESULT:\n{json.dumps(result, default=str)}"
    )
    return _ask(system, user)


# NOTE: case_study_mentor moved to services/mentor.py (2026-07-28) — the
# mentor is now RAG-grounded and provider-chained; this file is transport only
# for it (via `ask`). explain_simulation above is kept for swap-back parity
# with services/ai_explain.py, same as services/gemini.py is kept.
