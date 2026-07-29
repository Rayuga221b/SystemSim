"""RagChunk — one embedded passage of platform content, for mentor retrieval.

The RAG corpus is derived data: chunks are rebuilt from roadmap_lessons (DB)
and case_studies.json by `python -m services.rag_index build`. Nothing here is
authored directly — if this table is dropped, a rebuild restores it.

WHY embeddings live in a JSON column (not pgvector): the corpus is ~400 chunks.
A 400×768 float32 matrix is ~1.2 MB — it fits in process memory and exact
brute-force cosine beats an ANN index on both latency and correctness at this
scale. The JSON column keeps the schema portable across the SQLite dev
fallback and Postgres prod. Upgrade path (pgvector + HNSW at ~50k chunks) is
documented in docs/RAG.md with the math.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Integer, Text, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class RagChunk(Base):
    __tablename__ = "rag_chunks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # Where the chunk came from. source_type: "roadmap" | "case_study".
    # source_slug + anchor let the frontend deep-link a citation straight to
    # the section it came from (/learn/roadmap/<slug>#<anchor>).
    source_type: Mapped[str] = mapped_column(String, nullable=False, index=True)
    source_slug: Mapped[str] = mapped_column(String, nullable=False, index=True)
    source_title: Mapped[str] = mapped_column(String, nullable=False)
    heading: Mapped[str | None] = mapped_column(String, nullable=True)
    anchor: Mapped[str | None] = mapped_column(String, nullable=True)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)

    # The passage as it will appear in the prompt (plain markdown).
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # sha256 of the embedded text — the idempotency key for index rebuilds:
    # unchanged content is never re-embedded (same pattern as the roadmap
    # ingest's day-unique upsert).
    content_hash: Mapped[str] = mapped_column(String, nullable=False, index=True)

    # L2-normalized vector + the model that produced it. Vectors from
    # different models are not comparable, so the model id is stored alongside
    # and checked at retrieval time.
    embedding: Mapped[list[float]] = mapped_column(JSON, nullable=False)
    embedding_model: Mapped[str] = mapped_column(String, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
