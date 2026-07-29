"""One-off: merge a recovered pre-wipe systemsim.db (from an old device
backup) into Neon — restoring lessons where the old, original Gemini-era
content is measurably richer than what's been regenerated since the
empty-database incident (docs/INCIDENTS.md #1).

The backup is a partial, older snapshot (31/76 lessons, dated 2026-07-16 —
the original Gemini-only ingest run, before it moved to Groq). Not every
day in it is worth restoring: the 6 Foundations days (1-6) are identical
to what's already there (same hand-authored seed script either side), and
a few days (22, 23, 30, 38, 39) the current qwen-generated version is
already equal or better. Day-by-day comparison (body_md length as the
quality proxy) done by hand before writing this list — see
backend/BACKEND_LOG.md for the full comparison table.

Two categories, both idempotent upserts by `day`:
- UPGRADE: day exists in Neon already, old backup's version is richer —
  overwrite.
- FILL: day doesn't exist in Neon yet — pure addition, no AI needed.

Day 64 is a FILL that references the old static-SVG diagram style
(`![...](/static/roadmap/diagrams/database-sharding.svg)`) — that asset
doesn't ship anymore (converted to inline Mermaid project-wide, see
BACKEND_LOG 2026-07-29). `scripts/attach_diagrams.py` already has an
authored Mermaid replacement for day 64; run it right after this script.

Days 4 and 22 in the backup ALSO use the old image-ref style but are
deliberately excluded from restoration — the current versions (from the
already-fixed `seed_roadmap.py`) use inline Mermaid and restoring the old
ones would be a regression.

Also restores `users`/`designs`/`challenge_attempts` rows wholesale — Neon
had zero rows in all three (nothing to lose by overwriting).

Run:  python -m scripts.merge_old_device_backup /path/to/old/systemsim.db
"""
from __future__ import annotations

import sys

from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import create_engine, select  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from db.session import SessionLocal  # noqa: E402
from models.challenge_attempt import ChallengeAttempt  # noqa: E402
from models.design import Design  # noqa: E402
from models.roadmap_lesson import RoadmapLesson  # noqa: E402
from models.user import User  # noqa: E402

# Richer than current Neon content — overwrite.
UPGRADE_DAYS = {7, 8, 9, 10, 15, 16, 19, 24, 29, 37, 43}
# Not in Neon yet — pure addition. 64 needs attach_diagrams.py run after.
FILL_DAYS = {64, 65, 66, 68, 69, 70, 73, 75, 76}

_LESSON_FIELDS = [
    "day", "slug", "module", "module_order", "order_in_module",
    "title", "subtitle", "summary", "reading_minutes", "body_md",
    "key_takeaways", "interview_angle", "tags", "diagram_refs",
    "attribution", "published",
]


def _copy_lessons(src: Session, dst: Session) -> None:
    days = UPGRADE_DAYS | FILL_DAYS
    rows = src.execute(
        select(RoadmapLesson).where(RoadmapLesson.day.in_(days))
    ).scalars().all()
    for row in rows:
        existing = dst.execute(
            select(RoadmapLesson).where(RoadmapLesson.day == row.day)
        ).scalar_one_or_none()
        kind = "upgrade" if row.day in UPGRADE_DAYS else "fill"
        target = existing or RoadmapLesson(day=row.day)
        for field in _LESSON_FIELDS:
            setattr(target, field, getattr(row, field))
        dst.add(target)
        print(f"  [{kind}] day {row.day}: {row.slug} ({len(row.body_md)} chars)")
    dst.commit()


def _copy_accounts(src: Session, dst: Session) -> None:
    for model, label in ((User, "users"), (Design, "designs"),
                          (ChallengeAttempt, "challenge_attempts")):
        rows = src.execute(select(model)).scalars().all()
        for row in rows:
            dst.merge(row)
        print(f"  [{label}] {len(rows)} row(s) restored")
    dst.commit()


def run(old_db_path: str) -> None:
    src_engine = create_engine(f"sqlite:///{old_db_path}")
    src = Session(src_engine)
    dst = SessionLocal()
    try:
        print("Lessons:")
        _copy_lessons(src, dst)
        print("Accounts:")
        _copy_accounts(src, dst)
    finally:
        src.close()
        dst.close()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python -m scripts.merge_old_device_backup <path-to-old-systemsim.db>")
    run(sys.argv[1])
