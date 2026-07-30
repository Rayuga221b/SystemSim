"""Grounded generation core — RAG-grounded answers with verifiable citations.

Orchestration only; the moving parts live where they belong:
  services/rag.py         retrieval (chunks + scores)
  services/embeddings.py  query embedding (Gemini)
  services/groq.py        generation (GROQ_MENTOR_MODEL, GROQ_MODEL fallback)

Three callers share this core (DECISION 2026-07-29, extended 2026-07-30 for
roadmap lessons): the per-case-study mentor widget (`answer()`, still backing
`POST /ai/mentor`), the per-roadmap-lesson mentor widget (`answer_roadmap()`,
also backing `POST /ai/mentor` via `roadmap_slug`), and the global floating
assistant (`services/chat.py` → `respond()` directly, supporting case_study /
sandbox / roadmap / contextless "general" modes). Same prompt, same citation
contract, same generation core — one place to get the RAG behavior right
instead of prompts drifting apart across three surfaces.

DECISION (2026-07-28, docs/RAG.md): two departures from earlier notes, both
driven by "this deploys live":

1. RAG instead of pure single-document stuffing. Retrieval pulls the 3-4 most
   relevant passages from the WHOLE platform corpus (76 roadmap lessons + all
   case studies), not just the current document.
2. Provider chain Claude → Groq, not Claude-only — a deployed product cannot
   503 behind a placeholder key. (Superseded 2026-07-30 below — Claude is
   gone, kept here as the historical reason RAG was built chain-tolerant.)

DECISION (2026-07-30, Satyam's call): Anthropic dropped entirely — every AI
task now runs on Groq (generation) or Gemini (embeddings only), no task uses
Claude. `services/claude.py` deleted. `_generate` below keeps a two-attempt
shape (GROQ_MENTOR_MODEL, then GROQ_MODEL) so a single bad/rate-limited
model id still degrades gracefully instead of 503ing outright — same spirit
as the old cross-provider chain, just within one provider now.

DECISION (2026-07-29, supersedes CLAUDE.md's "no open-ended chat" for this ONE
carve-out): the system prompt now allows a bounded general-knowledge fallback
— ONLY when the question is unrelated to any given context AND no retrieved
passage is relevant. This keeps the platform corpus as the default, primary
source (see PRIORITY ORDER in _SYSTEM) rather than making the assistant a
generic chatbot; it fires for the minority of questions retrieval genuinely
has nothing for, not as an escape hatch from grounding.

CITATIONS ARE NOT MODEL OUTPUT, AND NOW MUST BE ACTUALLY CITED. The sources
list is assembled from retrieval metadata, filtered to only the [S#] tags the
model's answer text actually references. FIX (2026-07-29): earlier, `sources`
included every retrieved chunk regardless of whether the model used it — an
off-topic question (verified live: "what's your favorite pizza topping?")
retrieved 4 chunks at borderline scores (~0.52, just over the 0.45 floor,
which is noise-level similarity for generic text against any corpus), the
model correctly ignored all of them, but the UI still rendered 4 "Grounded
in" chips backing an answer that never touched them. Filtering by citation
instead of by retrieval is the more robust fix — it doesn't require ever
tuning a threshold to be perfect, because "did the model use it" is a much
better final answer than "did it score above X."

FAILURE CONTRACT: retrieval failing (embeddings down, empty index) degrades
to the pre-RAG behavior — context-only prompt, empty sources. Only generation
failing on both Groq attempts (mentor model, then base model) raises
AIUnavailable → the caller's 503.
"""
from __future__ import annotations

import json
import re
from typing import Any

from sqlalchemy.orm import Session

from services import groq
from services.rag import Retrieved, retrieve


class AIUnavailable(Exception):
    """Groq is not configured/reachable (no ANTHROPIC fallback anymore — see
    DECISION 2026-07-30 below)."""


_SYSTEM = (
    "You are the SystemSim AI assistant — a distributed-systems mentor "
    "embedded in an interactive learning platform (a canvas simulator, "
    "scored challenges, engineering case studies, and a 76-lesson system-"
    "design roadmap).\n\n"
    "Answer using this PRIORITY ORDER:\n"
    "1. If CONTEXT is given below (a case study, or the user's current "
    "sandbox architecture + last simulation result), ground your answer in "
    "it first.\n"
    "2. If PLATFORM PASSAGES are given, tagged [S1], [S2]… — weave in any "
    "that are genuinely relevant and cite the tag inline, e.g. '…consistent "
    "hashing spreads the keys [S1].' Never cite a tag you were not given. "
    "Silently ignore passages that don't actually help — do not mention, "
    "list, or apologize for irrelevant ones.\n"
    "3. ONLY if the question is unrelated to any CONTEXT you were given, AND "
    "no PLATFORM PASSAGE is relevant, you may answer from your own general "
    "engineering knowledge — but say so plainly first (e.g. 'Outside "
    "SystemSim's own content, but generally speaking…') so the user knows "
    "it isn't grounded in the platform. Keep this general answer short.\n\n"
    "If the question has nothing to do with software or systems engineering "
    "and there is no relevant CONTEXT or PASSAGE either, briefly say it's "
    "outside what you help with and redirect to the current context if any "
    "exists.\n\n"
    "Under 220 words, plain language, no headers."
)


def _context_block(case_study: dict[str, Any] | None,
                   sandbox: dict[str, Any] | None,
                   roadmap: dict[str, Any] | None = None) -> str | None:
    if case_study:
        fields = {k: case_study.get(k) for k in
                  ("company", "title", "one_liner", "problem", "solution",
                   "scale_context", "lessons")}
        return f"CASE STUDY:\n{json.dumps(fields, default=str)}"
    if roadmap:
        fields = {k: roadmap.get(k) for k in
                  ("day", "title", "subtitle", "body_md", "key_takeaways")}
        return f"ROADMAP LESSON:\n{json.dumps(fields, default=str)}"
    if sandbox and sandbox.get("graph"):
        parts = [f"YOUR CURRENT SANDBOX ARCHITECTURE:\n{json.dumps(sandbox['graph'], default=str)}"]
        if sandbox.get("result"):
            parts.append(f"LAST SIMULATION RESULT:\n{json.dumps(sandbox['result'], default=str)}")
        return "\n\n".join(parts)
    return None


def _passages_block(chunks: list[Retrieved]) -> str | None:
    if not chunks:
        return None
    passages = "\n\n".join(
        f"[S{i}] ({c.source_title}" + (f" — {c.heading})" if c.heading else ")")
        + f"\n{c.content}"
        for i, c in enumerate(chunks, 1)
    )
    return f"PLATFORM PASSAGES (retrieved, may or may not be relevant):\n{passages}"


def _prompt(question: str, *, case_study: dict[str, Any] | None,
            sandbox: dict[str, Any] | None, roadmap: dict[str, Any] | None,
            chunks: list[Retrieved]) -> str:
    parts = [b for b in (_context_block(case_study, sandbox, roadmap), _passages_block(chunks)) if b]
    parts.append(f"QUESTION: {question}")
    return "\n\n".join(parts)


def _generate(system: str, user: str) -> tuple[str, str]:
    """Groq only (DECISION 2026-07-30: Anthropic dropped entirely, no task
    uses Claude anymore). Returns (text, provider) — provider is always
    "groq" now; kept in the return shape since callers/tests/the API
    response still key off it.

    Still a two-attempt chain, just within Groq: GROQ_MENTOR_MODEL first
    (tunable independently for mentor/chat quality), GROQ_MODEL as a
    fallback so one bad/rate-limited model id doesn't 503 the assistant
    outright. Catches Exception broadly on the first attempt for the same
    reason the old cross-provider chain did — any failure mode (bad model
    id, quota, outage) should fall through, not just "not configured."
    """
    try:
        return groq.generate_text(system, user, model=groq.GROQ_MENTOR_MODEL, max_tokens=700), "groq"
    except Exception:  # noqa: BLE001 — fall through to the plain GROQ_MODEL
        pass
    try:
        return groq.generate_text(system, user, max_tokens=700), "groq"
    except groq.AIUnavailable as e:
        raise AIUnavailable(str(e)) from e


def _source_path(c: Retrieved) -> str:
    base = f"/learn/roadmap/{c.source_slug}" if c.source_type == "roadmap" \
        else f"/case-studies/{c.source_slug}"
    return f"{base}#{c.anchor}" if c.anchor else base


def _cited_sources(answer_text: str, chunks: list[Retrieved]) -> list[dict[str, Any]]:
    """Sources actually referenced by the model's [S#] tags — not merely
    retrieved. See module docstring: this is the fix for citations that
    decorated an answer they didn't inform."""
    cited = {int(n) for n in re.findall(r"\[S(\d+)\]", answer_text)}
    return [
        {
            "tag": f"S{i}",
            "source_type": c.source_type,
            "slug": c.source_slug,
            "title": c.source_title,
            "heading": c.heading,
            "path": _source_path(c),
            "score": round(c.score, 3),
        }
        for i, c in enumerate(chunks, 1) if i in cited
    ]


def respond(db: Session, question: str, *, case_study: dict[str, Any] | None = None,
            sandbox: dict[str, Any] | None = None, roadmap: dict[str, Any] | None = None,
            exclude_slug: str | None = None) -> dict[str, Any]:
    """RAG-grounded answer for any context mode.

    case_study xor sandbox xor roadmap xor neither (general, platform-wide
    RAG only).

    Response shape:
      answer    str   — the mentor's reply, may contain inline [S1] tags
      sources   list  — only chunks the answer actually cited (tag order)
      grounded  bool  — whether the answer was actually backed by a citation
      provider  str   — "groq" (kept as a field for response-shape stability;
                        historically distinguished Claude vs Groq)
    """
    try:
        chunks = retrieve(db, question, exclude_slug=exclude_slug)
    except Exception:  # noqa: BLE001 — retrieval must never take down the mentor
        chunks = []

    text, provider = _generate(
        _SYSTEM,
        _prompt(question, case_study=case_study, sandbox=sandbox, roadmap=roadmap, chunks=chunks),
    )
    sources = _cited_sources(text, chunks)

    return {"answer": text, "grounded": bool(sources), "provider": provider, "sources": sources}


def answer(db: Session, case_study: dict[str, Any], question: str) -> dict[str, Any]:
    """Back-compat entry point for the case-study mentor widget (POST /ai/mentor)."""
    return respond(db, question, case_study=case_study, exclude_slug=case_study.get("slug"))


def answer_roadmap(db: Session, lesson: dict[str, Any], question: str) -> dict[str, Any]:
    """Entry point for the roadmap-lesson mentor widget (POST /ai/mentor,
    roadmap_slug variant) — mirrors `answer()`, excluding the lesson's own
    chunk from retrieval so it never cites itself."""
    return respond(db, question, roadmap=lesson, exclude_slug=lesson.get("slug"))
