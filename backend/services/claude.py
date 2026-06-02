"""Single place that talks to the Claude API. Model id lives here only."""
import os

# One source of truth for the model. Spec pins this; a newer Sonnet
# (claude-sonnet-4-6) exists as of 2026 — change here when ready.
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-20250514")

# TODO: from anthropic import Anthropic; client = Anthropic(api_key=...)
# Helpers to build context-scoped prompts (explain / mentor / ingest extract).
