"""RAG core — markdown-aware chunking + exact in-process retrieval.

Two halves, deliberately in one file because they share the chunk contract:

  chunk_markdown() / chunk_case_study()  — corpus → Chunk passages
  retrieve()                             — question → top-k scored chunks

RETRIEVAL DESIGN (the load-bearing decision, see docs/RAG.md):
The corpus is ~400 chunks. We load every embedding into one numpy float32
matrix (~1.2 MB) cached in-process and do exact cosine via a single matrix ·
vector product — sub-millisecond, zero infrastructure, zero recall loss.
An ANN index (pgvector/HNSW) buys speed at scale by *approximating*; paying
that complexity below ~50k vectors is engineering theater. The cache
invalidates on a cheap (count, max_created_at) fingerprint query per call, so
a rebuilt index is picked up without restarting the server.

FAILURE CONTRACT: retrieve() raises AIUnavailable only if embedding the query
fails; an EMPTY index returns [] without calling the embeddings API at all.
Callers (services/mentor.py) treat any retrieval failure as "no chunks" — RAG
must never take down the base mentor feature.
"""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field

import numpy as np
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from models.rag_chunk import RagChunk
from services.embeddings import EMBEDDING_MODEL, embed_query

# ── Chunking ─────────────────────────────────────────────────────────────────
# Target ~350-450 tokens per chunk (chars/4 heuristic). Small enough that a
# retrieved hit is *about* the question (precision, prompt cost), large enough
# to carry a complete thought. Long sections split on paragraph boundaries
# with one-paragraph overlap so a sentence straddling a cut exists in both.
MAX_CHARS = 1600
OVERLAP_PARAS = 1
MIN_CHARS = 80  # drop fragments (a lone heading, a stray sentence)

# The ingest prompt (services/roadmap_ingest.py) ends every lesson with a
# "Try it in the sandbox" activity nudge — identical in spirit across all 76
# lessons. It's a real section, so it chunks and embeds fine, but it's an
# instruction to the READER ("build this yourself"), not explanatory content —
# citing it as grounding for an answer is technically correct and practically
# useless. Verified live (2026-07-29): it surfaced as a citation chip next to
# real technical sources, diluting them. Excluded at chunk time rather than
# filtered at retrieval time — it should never enter the index at all.
_BOILERPLATE_HEADING_PREFIX = "try it in the sandbox"


@dataclass
class Chunk:
    source_type: str          # "roadmap" | "case_study"
    source_slug: str
    source_title: str
    heading: str | None
    anchor: str | None
    chunk_index: int
    content: str
    embed_text: str = field(default="")  # what actually gets embedded

    def __post_init__(self):
        if not self.embed_text:
            # Prefix title/heading context: a chunk that says "it uses
            # consistent hashing" embeds much better as "Day 12 — Caching >
            # Cache invalidation: it uses consistent hashing".
            head = f"{self.source_title}"
            if self.heading:
                head += f" — {self.heading}"
            self.embed_text = f"{head}\n\n{self.content}"

    @property
    def content_hash(self) -> str:
        return hashlib.sha256(self.embed_text.encode("utf-8")).hexdigest()


def _anchor(heading: str) -> str:
    """Mirror the frontend Markdown renderer's heading-id slugify, so citation
    deep links (#anchor) land on the actual rendered heading."""
    return re.sub(r"[^a-z0-9]+", "-", heading.lower()).strip("-")


def _split_long(text: str) -> list[str]:
    """Split an oversized section on paragraph boundaries with overlap."""
    paras = [p for p in re.split(r"\n\s*\n", text) if p.strip()]
    parts: list[str] = []
    cur: list[str] = []
    size = 0
    for p in paras:
        if cur and size + len(p) > MAX_CHARS:
            parts.append("\n\n".join(cur))
            cur = cur[-OVERLAP_PARAS:]  # carry overlap forward
            size = sum(len(c) for c in cur)
        cur.append(p)
        size += len(p)
    if cur:
        parts.append("\n\n".join(cur))
    return parts


def chunk_markdown(source_type: str, slug: str, title: str, body_md: str) -> list[Chunk]:
    """Split a markdown document into heading-scoped chunks.

    Sections are cut at ## headings (the document's own semantic boundaries —
    a chunk never mixes two topics). Content before the first ## becomes an
    intro chunk. Fenced code blocks are kept intact: a split never lands
    inside one because splitting happens on blank lines outside fences.
    """
    # Protect fenced blocks from being treated as paragraph boundaries by
    # temporarily collapsing their inner blank lines.
    fences: list[str] = []

    def _stash(m: re.Match) -> str:
        fences.append(m.group(0))
        return f"\x00FENCE{len(fences) - 1}\x00"

    safe = re.sub(r"```.*?```", _stash, body_md, flags=re.DOTALL)

    def _restore(text: str) -> str:
        return re.sub(r"\x00FENCE(\d+)\x00", lambda m: fences[int(m.group(1))], text)

    sections: list[tuple[str | None, str]] = []
    current_heading: str | None = None
    buf: list[str] = []
    for line in safe.split("\n"):
        m = re.match(r"^##\s+(.*)", line)
        if m:
            if buf:
                sections.append((current_heading, "\n".join(buf).strip()))
            current_heading = m.group(1).strip()
            buf = []
        else:
            buf.append(line)
    if buf:
        sections.append((current_heading, "\n".join(buf).strip()))

    chunks: list[Chunk] = []
    idx = 0
    for heading, text in sections:
        if heading and heading.strip().lower().startswith(_BOILERPLATE_HEADING_PREFIX):
            continue
        text = _restore(text).strip()
        if len(text) < MIN_CHARS:
            continue
        for part in (_split_long(text) if len(text) > MAX_CHARS else [text]):
            chunks.append(Chunk(
                source_type=source_type,
                source_slug=slug,
                source_title=title,
                heading=heading,
                anchor=_anchor(heading) if heading else None,
                chunk_index=idx,
                content=part,
            ))
            idx += 1
    return chunks


def chunk_case_study(cs: dict) -> list[Chunk]:
    """Case studies chunk per narrative field. The anchors ("problem",
    "solution", "lessons") match the section ids CaseStudyDetail.jsx renders,
    so citations deep-link to the exact section."""
    title = f"{cs['company']}: {cs['title']}"
    chunks: list[Chunk] = []
    idx = 0
    fields = [
        ("The Problem", "problem", cs.get("problem", "")),
        ("The Solution", "solution", cs.get("solution", "")),
        ("Lessons", "lessons", "\n\n".join(cs.get("lessons", []))),
    ]
    for heading, anchor, text in fields:
        text = (text or "").strip()
        if len(text) < MIN_CHARS:
            continue
        for part in (_split_long(text) if len(text) > MAX_CHARS else [text]):
            chunks.append(Chunk(
                source_type="case_study",
                source_slug=cs["slug"],
                source_title=title,
                heading=heading,
                anchor=anchor,
                chunk_index=idx,
                content=part,
            ))
            idx += 1
    return chunks


# ── Retrieval ────────────────────────────────────────────────────────────────
TOP_K = 4            # chunks that make it into the prompt
MIN_SCORE = 0.45     # cosine floor — below this it's noise, not grounding
PER_SOURCE_CAP = 2   # diversity: one document can't fill the whole context


@dataclass
class Retrieved:
    score: float
    source_type: str
    source_slug: str
    source_title: str
    heading: str | None
    anchor: str | None
    content: str


# In-process index cache. Fingerprint = (row count, newest created_at): both
# change on any rebuild, and the check is one cheap aggregate query per call.
_cache: dict = {"fp": None, "matrix": None, "meta": None}


def _load_index(db: Session):
    fp = db.execute(
        select(func.count(RagChunk.id), func.max(RagChunk.created_at))
        .where(RagChunk.embedding_model == EMBEDDING_MODEL)
    ).one()
    if fp[0] == 0:
        return None, None, fp
    if _cache["fp"] == fp:
        return _cache["matrix"], _cache["meta"], fp

    rows = db.execute(
        select(RagChunk).where(RagChunk.embedding_model == EMBEDDING_MODEL)
    ).scalars().all()
    matrix = np.array([r.embedding for r in rows], dtype=np.float32)
    meta = [
        Retrieved(0.0, r.source_type, r.source_slug, r.source_title,
                  r.heading, r.anchor, r.content)
        for r in rows
    ]
    _cache.update(fp=fp, matrix=matrix, meta=meta)
    return matrix, meta, fp


def retrieve(db: Session, question: str, *, top_k: int = TOP_K,
             exclude_slug: str | None = None) -> list[Retrieved]:
    """Top-k chunks for a question. Empty index → [] with no API call.

    exclude_slug: the mentor already puts the full current case study in the
    prompt, so retrieving its own chunks would waste context slots on
    duplicates — pass its slug to filter them out.
    """
    matrix, meta, _ = _load_index(db)
    if matrix is None:
        return []

    q = np.array(embed_query(question), dtype=np.float32)
    scores = matrix @ q  # both sides L2-normalized → dot == cosine

    order = np.argsort(-scores)
    picked: list[Retrieved] = []
    per_source: dict[str, int] = {}
    for i in order:
        s = float(scores[i])
        if s < MIN_SCORE or len(picked) >= top_k:
            break
        m = meta[i]
        if exclude_slug and m.source_slug == exclude_slug:
            continue
        if per_source.get(m.source_slug, 0) >= PER_SOURCE_CAP:
            continue
        per_source[m.source_slug] = per_source.get(m.source_slug, 0) + 1
        picked.append(Retrieved(s, m.source_type, m.source_slug, m.source_title,
                                m.heading, m.anchor, m.content))
    return picked
