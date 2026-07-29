"""One-off: copy roadmap_lessons rows from the local SQLite dev DB into Neon.

Context: local dev ran on a SQLite fallback file while the Neon (Postgres)
setup was being wired up. Rather than re-run the Groq ingest against Neon
directly (burning free-tier quota twice for the same content), this copies
the already-ingested rows across by primary content, not by re-generating.

Idempotent by `day` (unique) — safe to re-run after the source SQLite file
gains more rows (e.g. once a still-running ingest batch finishes more days).
Source is hardcoded to the local dev SQLite path on purpose: this script only
ever runs by hand, once, during the Postgres migration — no env var needed
for a path that never varies.

Run:  python -m scripts.copy_roadmap_to_neon
"""
from __future__ import annotations

from dotenv import load_dotenv

# Standalone script — nothing else loads backend/.env here, so DATABASE_URL
# (the Neon connection string) wouldn't be visible without this. Must run
# before importing db.session, which reads DATABASE_URL at import time.
load_dotenv()

from sqlalchemy import create_engine, select  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from db.session import SessionLocal  # noqa: E402
from models.roadmap_lesson import RoadmapLesson  # noqa: E402

SQLITE_URL = "sqlite:///./systemsim.db"

_COPY_FIELDS = [
    "day", "slug", "module", "module_order", "order_in_module",
    "title", "subtitle", "summary", "reading_minutes", "body_md",
    "key_takeaways", "interview_angle", "tags", "diagram_refs",
    "attribution", "published",
]


def run() -> None:
    src_engine = create_engine(SQLITE_URL)
    src = Session(src_engine)
    dst = SessionLocal()  # bound to DATABASE_URL (Neon), per db/session.py

    try:
        source_rows = src.execute(select(RoadmapLesson)).scalars().all()
        print(f"Found {len(source_rows)} lesson(s) in {SQLITE_URL}")

        copied = 0
        for row in source_rows:
            existing = dst.execute(
                select(RoadmapLesson).where(RoadmapLesson.day == row.day)
            ).scalar_one_or_none()
            target = existing or RoadmapLesson(day=row.day)
            for field in _COPY_FIELDS:
                setattr(target, field, getattr(row, field))
            dst.add(target)
            copied += 1
            print(f"  [ok] day {row.day}: {row.slug}")
        dst.commit()
        print(f"\nCopied {copied} lesson(s) into Neon.")
    finally:
        src.close()
        dst.close()


if __name__ == "__main__":
    run()
