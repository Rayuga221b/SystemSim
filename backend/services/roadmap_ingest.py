"""Roadmap ingestion — source reference in, ORIGINAL lesson out.

Pipeline (same copyright-safe principle as case studies, project decision
"AI-structured summaries, never raw scraped HTML"):

    fetch source .md (reference only, never stored/served)
        -> model restructures into an ORIGINAL lesson (our voice, our order)
        -> upsert into roadmap_lessons

The source series is used strictly as reference material for a transformation.
Nothing verbatim is committed to this repo or served to users; only the
restructured result is persisted. Run:

    python -m services.roadmap_ingest --days 1-7 --publish
    python -m services.roadmap_ingest --all           # dry transform, unpublished

DECISION (2026-07-29, Satyam's call): generation is a provider CHAIN,
Gemini -> Groq/qwen — same pattern already used by the mentor
(docs/RAG.md). Gemini goes first for quality (Groq/qwen is the tighter,
quota-constrained fallback, not the preferred model); Groq only kicks in
when Gemini raises `AIUnavailable` for any reason (quota, overload, no
key). Requires at least one of GEMINI_API_KEY / GROQ_API_KEY.
"""
from __future__ import annotations

import argparse
import json
import re
import urllib.request
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

# Standalone script (python -m services.roadmap_ingest) — unlike main.py, nothing
# else loads backend/.env here, so ANTHROPIC_API_KEY / CLAUDE_MODEL wouldn't be
# visible. Load it explicitly at import time.
load_dotenv()

from sqlalchemy import select  # noqa: E402

from db.session import SessionLocal
from models.roadmap_lesson import RoadmapLesson
# Provider chain (DECISION 2026-07-29): Gemini first for quality, falling
# back to Groq/qwen — supersedes the 2026-07-26 Groq-only note. See
# BACKEND_LOG.md.
from services.gemini import AIUnavailable as GeminiUnavailable
from services.gemini import generate_json as gemini_generate_json
from services.groq import AIUnavailable as GroqUnavailable
from services.groq import GROQ_INGEST_MODEL
from services.groq import generate_json as groq_generate_json
from services.roadmap import curriculum, module_of

# Source repo — reference input only. Overridable so the source can move or be
# pointed at a local mirror without code changes.
import os

SOURCE_REPO = os.getenv("ROADMAP_SOURCE_REPO", "Sunchit/SystemDesignInterviewPreparationSeries")
SOURCE_BRANCH = os.getenv("ROADMAP_SOURCE_BRANCH", "main")
RAW_BASE = f"https://raw.githubusercontent.com/{SOURCE_REPO}/{SOURCE_BRANCH}"
API_TREE = f"https://api.github.com/repos/{SOURCE_REPO}/git/trees/{SOURCE_BRANCH}?recursive=1"

# Gitignored cache so re-runs are offline and we don't hammer the source.
CACHE_DIR = Path(__file__).resolve().parent.parent / "data" / "roadmap_source_cache"

ATTRIBUTION = (
    "Adapted and restructured from the “System Design Interview Preparation "
    "Series” by Sunchit Dudeja. Rewritten in SystemSim's own words; concepts "
    "are industry-standard."
)


def _fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "SystemSim-ingest"})
    with urllib.request.urlopen(req, timeout=30) as r:  # noqa: S310 (trusted host)
        return r.read().decode("utf-8")


def source_index() -> dict[int, str]:
    """Map day number -> source file path (DayN_*.md), from the repo tree."""
    tree = json.loads(_fetch(API_TREE)).get("tree", [])
    idx: dict[int, str] = {}
    for entry in tree:
        m = re.match(r"^Day(\d+)_.*\.md$", entry["path"])
        if m:
            idx[int(m.group(1))] = entry["path"]
    return idx


def fetch_source(day: int, path: str) -> str:
    """Fetch a source lesson, caching locally (cache is gitignored)."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cached = CACHE_DIR / f"day{day}.md"
    if cached.exists():
        return cached.read_text(encoding="utf-8")
    text = _fetch(f"{RAW_BASE}/{path}")
    cached.write_text(text, encoding="utf-8")
    return text


_SYSTEM = (
    "You are the lead content author for SystemSim, an interactive system-design "
    "learning platform. You are given ONE reference article as raw material. "
    "Produce an ORIGINAL, restructured lesson that teaches the same underlying "
    "engineering concepts in SystemSim's own voice — do NOT copy sentences or "
    "structure from the source; rewrite from understanding. Technical facts are "
    "shared knowledge; the expression must be entirely yours.\n\n"
    "Voice: a pragmatic senior engineer explaining a concept to a strong junior. "
    "Clear, concrete, lightly conversational, no fluff, no emoji. Assume the "
    "reader will next go build the thing in SystemSim's sandbox.\n\n"
    "Return STRICT JSON (no markdown fence) with keys:\n"
    "  title            — short, plain (not clickbait)\n"
    "  subtitle         — one line, the core idea\n"
    "  summary          — 1-2 sentence preview for a card\n"
    "  reading_minutes  — integer estimate\n"
    "  tags             — 2-5 lowercase topic tags\n"
    "  key_takeaways    — 3-5 crisp bullet strings\n"
    "  interview_angle  — 2-4 sentences: how to talk about this in an interview\n"
    "  body_md          — the lesson in GitHub-flavored Markdown. Use ## / ### "
    "headings, short paragraphs, tables where they clarify, and fenced code "
    "blocks ONLY where they add value. CRUCIAL: every code block, diagram, and "
    "table must be followed by a plain-language paragraph explaining it — never "
    "leave a reader staring at code with no words around it. Start with a 2-3 "
    "sentence hook on why this matters. End body_md with a short 'Try it in the "
    "sandbox' nudge tying the idea to building/simulating it.\n\n"
    "DIAGRAMS: whenever a flowchart, decision tree, sequence of steps, or "
    "request/architecture flow would help, express it as a MERMAID diagram in a "
    "```mermaid fenced block — NEVER as ASCII art with │ ├ └ box characters. "
    "Use `flowchart TD` or `flowchart LR` for flows/decision trees and "
    "`sequenceDiagram` for interactions. Keep node labels short (a few words); "
    "put detail in the explanation paragraph, not inside nodes. Prefer one clear "
    "diagram over many. Example:\n"
    "```mermaid\nflowchart TD\n  A([Request]) --> B{Cache hit?}\n"
    "  B -- Yes --> C[Return cached]\n  B -- No --> D[(Database)]\n```"
)


# Controlled-generation schema — guarantees valid, escaped JSON back from Gemini
# (body_md is a big multi-line string; without this it comes back with raw
# newlines and breaks the parse). propertyOrdering keeps body_md last so the
# model plans metadata before the long write.
_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "subtitle": {"type": "string"},
        "summary": {"type": "string"},
        "reading_minutes": {"type": "integer"},
        "tags": {"type": "array", "items": {"type": "string"}},
        "key_takeaways": {"type": "array", "items": {"type": "string"}},
        "interview_angle": {"type": "string"},
        "body_md": {"type": "string"},
    },
    "required": ["title", "subtitle", "summary", "reading_minutes", "tags",
                 "key_takeaways", "interview_angle", "body_md"],
    "propertyOrdering": ["title", "subtitle", "summary", "reading_minutes",
                         "tags", "key_takeaways", "interview_angle", "body_md"],
}


# Groq free tier enforces a per-minute token cap (8k/min for qwen) checked at
# request time against prompt + max_completion_tokens (HTTP 413 — never
# retryable). Budget both sides of the request: truncate the reference when it
# is oversized (it's raw material for a rewrite, not the product) and give the
# rest of the budget to the output. Estimates use a conservative 3 chars/token.
_TPM_BUDGET = 7600
_MIN_OUTPUT_TOKENS = 2800


def _est_tokens(text: str) -> int:
    return max(1, len(text) // 3)


def _groq_transform(day: int, source_md: str) -> str:
    """The Groq/qwen fallback path — tight free-tier budgeting, unchanged
    from the Groq-only era. Only reached when Gemini is unavailable."""
    # ~400 tokens covers the injected response schema + message framing.
    overhead = _est_tokens(_SYSTEM) + 400
    max_source_chars = (_TPM_BUDGET - _MIN_OUTPUT_TOKENS - overhead) * 3
    source = source_md
    if len(source) > max_source_chars:
        cut = source.rfind("\n", 0, max_source_chars)
        source = source[:cut if cut > 0 else max_source_chars]
        source += "\n\n[reference truncated to fit the model's context budget]"
    user = f"Reference article (Day {day}) — raw material only:\n\n{source}"
    max_out = min(8192, _TPM_BUDGET - overhead - _est_tokens(user))
    return groq_generate_json(
        _SYSTEM,
        user,
        model=GROQ_INGEST_MODEL,
        max_tokens=max_out,
        response_schema=_SCHEMA,
        # No thinking: the 8k/min cap leaves no budget for reasoning tokens,
        # and truncated thinking fails Groq's JSON-mode validation outright.
        reasoning_effort="none",
    )


def transform(day: int, source_md: str) -> dict[str, Any]:
    """Reference article -> original structured lesson. Tries Gemini first
    (generous context window, no source truncation needed, generally the
    stronger writer for this); falls back to Groq/qwen — with its tighter
    free-tier budgeting — only when Gemini raises AIUnavailable (quota,
    overload, or no key configured)."""
    user = f"Reference article (Day {day}) — raw material only:\n\n{source_md}"
    try:
        text = gemini_generate_json(
            _SYSTEM, user, max_tokens=16384, response_schema=_SCHEMA,
        )
    except GeminiUnavailable as e:
        print(f"    [gemini unavailable, falling back to groq] {e}", flush=True)
        text = _groq_transform(day, source_md)
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text).strip()
    return json.loads(text)


def _slugify(title: str, day: int) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:60].strip("-")
    return f"day-{day}-{base}" if base else f"day-{day}"


def upsert(db, day: int, data: dict[str, Any], publish: bool) -> RoadmapLesson:
    mod = module_of(day)
    module_id = mod["id"] if mod else "foundations"
    slug = _slugify(data["title"], day)

    lesson = db.execute(
        select(RoadmapLesson).where(RoadmapLesson.day == day)
    ).scalar_one_or_none() or RoadmapLesson(day=day)

    lesson.slug = slug
    lesson.module = module_id
    lesson.title = data["title"]
    lesson.subtitle = data.get("subtitle")
    lesson.summary = data["summary"]
    lesson.reading_minutes = int(data.get("reading_minutes", 6))
    lesson.body_md = data["body_md"]
    lesson.key_takeaways = data.get("key_takeaways", [])
    lesson.interview_angle = data.get("interview_angle")
    lesson.tags = data.get("tags", [])
    lesson.attribution = ATTRIBUTION
    if publish:
        lesson.published = True

    db.add(lesson)
    db.commit()
    db.refresh(lesson)
    return lesson


def ingest_days(days: list[int], publish: bool = False) -> None:
    """Transform + store each day. Resilient: one bad day (network hiccup, model
    returns non-JSON) is logged and skipped, never aborts the batch."""
    idx = source_index()
    db = SessionLocal()
    done, failed = 0, []
    try:
        for day in days:
            if day not in idx:
                print(f"  [skip] day {day}: no source file")
                continue
            print(f"  [..] day {day}: fetching + transforming", flush=True)
            try:
                src = fetch_source(day, idx[day])
                data = transform(day, src)
                lesson = upsert(db, day, data, publish)
                done += 1
                print(f"  [ok] day {day}: {lesson.slug} "
                      f"({'published' if lesson.published else 'draft'})")
            except Exception as e:  # noqa: BLE001 — batch must survive one failure
                db.rollback()
                failed.append(day)
                print(f"  [FAIL] day {day}: {type(e).__name__}: {e}")
    finally:
        db.close()
    print(f"\nDone: {done} ingested, {len(failed)} failed"
          + (f" -> retry with --days {','.join(map(str, failed))}" if failed else ""))


def _parse_days(spec: str) -> list[int]:
    if spec == "all":
        return [d for m in curriculum()["modules"] for d in m["days"]]
    out: list[int] = []
    for part in spec.split(","):
        if "-" in part:
            a, b = part.split("-")
            out.extend(range(int(a), int(b) + 1))
        else:
            out.append(int(part))
    return out


def main() -> None:
    p = argparse.ArgumentParser(description="Ingest roadmap lessons.")
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--days", help="e.g. '1-7' or '1,3,5' or '9'")
    g.add_argument("--all", action="store_true", help="every day in the curriculum")
    p.add_argument("--publish", action="store_true", help="mark ingested lessons published")
    args = p.parse_args()

    days = _parse_days("all" if args.all else args.days)
    try:
        ingest_days(days, publish=args.publish)
    except (GeminiUnavailable, GroqUnavailable) as e:
        raise SystemExit(
            f"AI unavailable: {e}. Set GEMINI_API_KEY and/or GROQ_API_KEY to run ingestion."
        )


if __name__ == "__main__":
    main()
