"""RoadmapLesson — one day of the System Design Roadmap.

WHY a DB table (not a JSON file like challenges/case studies): the roadmap is
76+ long-form lessons and will grow; it's real content that wants pagination,
per-lesson queries, published/draft state, and (later) per-user progress — not
a blob loaded whole into memory. See CLAUDE.md "Challenges & scenarios are JSON"
— this is the deliberate exception, called out in BACKEND_LOG.md.

Content is ORIGINAL, AI-restructured material (copyright-safe, same principle as
case studies: "AI-structured summaries, never raw scraped HTML"). The raw source
series is used only as reference input to the ingest pipeline and is never
stored or served verbatim.
"""
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import String, Integer, Boolean, Text, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class RoadmapLesson(Base):
    __tablename__ = "roadmap_lessons"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # Sequencing. `day` is the canonical 1..N order; `module` groups days into
    # tracks for the sidebar, `order_in_module` orders within a track.
    day: Mapped[int] = mapped_column(Integer, nullable=False, unique=True, index=True)
    slug: Mapped[str] = mapped_column(String, nullable=False, unique=True, index=True)
    module: Mapped[str] = mapped_column(String, nullable=False, index=True)
    module_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    order_in_module: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Card + header text.
    title: Mapped[str] = mapped_column(String, nullable=False)
    subtitle: Mapped[str | None] = mapped_column(String, nullable=True)
    summary: Mapped[str] = mapped_column(Text, nullable=False)  # 1–2 line preview
    reading_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=6)

    # Body is original Markdown (GFM: headings, tables, fenced code). Rendered
    # rich on the frontend. Side panels below are pulled out so the reader can
    # style them distinctly (takeaways box, interview callout).
    body_md: Mapped[str] = mapped_column(Text, nullable=False)
    key_takeaways: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    interview_angle: Mapped[str | None] = mapped_column(Text, nullable=True)

    tags: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    # Slugs of pre-rendered diagram SVGs (see services/roadmap_ingest.py); the
    # asset lives under static/roadmap/diagrams/<ref>.svg.
    diagram_refs: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)

    # Credit line — content is adapted/restructured from the source series.
    attribution: Mapped[str | None] = mapped_column(Text, nullable=True)

    published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def card(self) -> dict[str, Any]:
        """Lightweight shape for list/sidebar — no heavy body."""
        return {
            "day": self.day,
            "slug": self.slug,
            "module": self.module,
            "title": self.title,
            "subtitle": self.subtitle,
            "summary": self.summary,
            "reading_minutes": self.reading_minutes,
            "tags": self.tags,
        }

    def detail(self) -> dict[str, Any]:
        """Full shape for the reader."""
        return {
            **self.card(),
            "body_md": self.body_md,
            "key_takeaways": self.key_takeaways,
            "interview_angle": self.interview_angle,
            "diagram_refs": self.diagram_refs,
            "attribution": self.attribution,
        }
