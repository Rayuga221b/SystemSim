"""RAG index builder — corpus → chunks → embeddings → rag_chunks table.

    python -m services.rag_index build       # incremental (only changed chunks)
    python -m services.rag_index build --force   # re-embed everything
    python -m services.rag_index status      # what's in the index

IDEMPOTENCY (same principle that saved the roadmap ingest — see BACKEND_LOG
2026-07-27): every chunk carries a sha256 of its embed text. A rebuild diffs
desired chunks against stored ones per source document:

  unchanged hash  → keep the row, skip the embedding call entirely
  changed / new   → embed + insert
  no longer produced → delete

So re-running after editing one lesson embeds only that lesson's chunks, a
crashed run resumes for free, and hammering `build` twice is a no-op. The
embeddings API is the expensive, rate-limited resource — the diff exists to
protect it.

The index is DERIVED data. Sources of truth stay where they were
(roadmap_lessons table, case_studies.json); dropping rag_chunks loses nothing
a rebuild can't restore.
"""
from __future__ import annotations

import argparse
from collections import defaultdict

from dotenv import load_dotenv

load_dotenv()  # standalone script — main.py's env loading doesn't apply here

from sqlalchemy import select  # noqa: E402

from db.session import SessionLocal
from models.rag_chunk import RagChunk
from models.roadmap_lesson import RoadmapLesson
from services.content import load_case_studies
from services.embeddings import EMBEDDING_MODEL, AIUnavailable, embed_documents
from services.rag import Chunk, chunk_case_study, chunk_markdown


def desired_chunks(db) -> list[Chunk]:
    """Chunk the full published corpus (roadmap lessons + case studies)."""
    chunks: list[Chunk] = []
    lessons = db.execute(
        select(RoadmapLesson).where(RoadmapLesson.published.is_(True))
    ).scalars().all()
    for l in lessons:
        chunks.extend(chunk_markdown("roadmap", l.slug, f"Day {l.day}: {l.title}", l.body_md))
    for cs in load_case_studies():
        if cs.get("published"):
            chunks.extend(chunk_case_study(cs))
    return chunks


def build(force: bool = False) -> None:
    db = SessionLocal()
    try:
        want = desired_chunks(db)
        have = db.execute(select(RagChunk)).scalars().all()

        # Index stored rows by (slug, chunk_index) — the stable identity of a
        # chunk within its document. Hash decides re-embedding.
        stored: dict[tuple[str, int], RagChunk] = {
            (r.source_slug, r.chunk_index): r for r in have
        }
        want_keys = {(c.source_slug, c.chunk_index) for c in want}

        to_embed: list[Chunk] = []
        kept = 0
        for c in want:
            row = stored.get((c.source_slug, c.chunk_index))
            if (not force and row is not None
                    and row.content_hash == c.content_hash
                    and row.embedding_model == EMBEDDING_MODEL):
                kept += 1
            else:
                to_embed.append(c)

        stale = [r for k, r in stored.items() if k not in want_keys]

        print(f"corpus: {len(want)} chunks desired · {kept} unchanged · "
              f"{len(to_embed)} to embed · {len(stale)} stale to delete")

        if to_embed:
            vectors = embed_documents([c.embed_text for c in to_embed])
            # Commit in small batches, not one insert for the whole corpus —
            # a single-transaction bulk insert of ~400 embedding rows was
            # observed dropping the Neon SSL connection mid-flush (large
            # statement, pooled/serverless backend). Batching keeps each
            # transaction small and makes a mid-run failure resumable: rows
            # already committed show up as "unchanged" on the next `build`.
            for i, (c, vec) in enumerate(zip(to_embed, vectors), start=1):
                row = stored.get((c.source_slug, c.chunk_index))
                if row is None:
                    row = RagChunk(source_slug=c.source_slug, chunk_index=c.chunk_index)
                    db.add(row)
                row.source_type = c.source_type
                row.source_title = c.source_title
                row.heading = c.heading
                row.anchor = c.anchor
                row.content = c.content
                row.content_hash = c.content_hash
                row.embedding = vec
                row.embedding_model = EMBEDDING_MODEL
                if i % 25 == 0 or i == len(to_embed):
                    db.commit()
                    print(f"  committed {i}/{len(to_embed)}", flush=True)

        for r in stale:
            db.delete(r)
        db.commit()

        print(f"done: index at {len(want)} chunks (model {EMBEDDING_MODEL})")
    finally:
        db.close()


def status() -> None:
    db = SessionLocal()
    try:
        rows = db.execute(select(RagChunk)).scalars().all()
        by_type: dict[str, int] = defaultdict(int)
        by_model: dict[str, int] = defaultdict(int)
        sources = set()
        for r in rows:
            by_type[r.source_type] += 1
            by_model[r.embedding_model] += 1
            sources.add(r.source_slug)
        print(f"{len(rows)} chunks from {len(sources)} documents")
        for t, n in sorted(by_type.items()):
            print(f"  {t}: {n}")
        for m, n in sorted(by_model.items()):
            print(f"  model {m}: {n}")
    finally:
        db.close()


def main() -> None:
    p = argparse.ArgumentParser(description="Build/inspect the RAG index.")
    sub = p.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build", help="incremental build (only changed chunks embed)")
    b.add_argument("--force", action="store_true", help="re-embed everything")
    sub.add_parser("status", help="index contents summary")
    args = p.parse_args()

    if args.cmd == "status":
        status()
        return
    try:
        build(force=args.force)
    except AIUnavailable as e:
        raise SystemExit(f"Embeddings unavailable: {e}")


if __name__ == "__main__":
    main()
