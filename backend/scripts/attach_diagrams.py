"""Attach hand-authored SVG diagrams to specific roadmap lessons.

The ingest pipeline writes lesson bodies but doesn't know about our custom
diagrams (they'd be third-party/copyright if pulled from the source). So diagrams
are authored by hand under static/roadmap/diagrams/ and stitched into the right
lessons here, by DAY number (slugs are model-generated and not stable).

Idempotent: skips a lesson whose body already references the diagram. Insertion
point is right after the lesson's opening hook paragraph, so the visual lands
near the top.

Run:  python -m scripts.attach_diagrams
"""
from __future__ import annotations

from sqlalchemy import select

from db.session import SessionLocal
from models.roadmap_lesson import RoadmapLesson

# day -> (diagram filename under static/roadmap/diagrams/, caption/alt text)
DIAGRAMS: dict[int, tuple[str, str]] = {
    28: ("consistent-hashing.svg",
         "Consistent hashing: each key belongs to the next node clockwise on the ring, so adding or removing a node only moves one arc of keys."),
    13: ("circuit-breaker-states.svg",
         "The circuit breaker's three states — Closed, Open, Half-Open — and the transitions between them."),
    45: ("saga-pattern.svg",
         "A saga runs local transactions forward and, on failure, undoes the committed steps in reverse with compensating actions."),
    64: ("database-sharding.svg",
         "A shard router maps each key to exactly one shard by its shard key; the shard key choice decides how evenly load spreads."),
    72: ("resilience-stack.svg",
         "The resilience stack: layered guards a request passes through in order — rate limiter, circuit breaker, bulkhead, timeout, retry, fallback."),
}

BASE = "/static/roadmap/diagrams"


def _insert_after_hook(body: str, image_md: str) -> str:
    """Place the image after the first paragraph (the opening hook)."""
    marker = "\n\n"
    i = body.find(marker)
    if i == -1:
        return f"{image_md}\n\n{body}"
    return body[: i + len(marker)] + image_md + "\n\n" + body[i + len(marker):]


def run() -> None:
    db = SessionLocal()
    changed = 0
    try:
        for day, (fname, caption) in DIAGRAMS.items():
            lesson = db.execute(
                select(RoadmapLesson).where(RoadmapLesson.day == day)
            ).scalar_one_or_none()
            if lesson is None:
                print(f"  [skip] day {day}: no lesson (not ingested yet)")
                continue
            ref = f"{BASE}/{fname}"
            if ref in (lesson.body_md or ""):
                print(f"  [skip] day {day}: already has {fname}")
                continue
            image_md = f"![{caption}]({ref})"
            lesson.body_md = _insert_after_hook(lesson.body_md, image_md)
            refs = list(lesson.diagram_refs or [])
            if fname not in refs:
                refs.append(fname)
                lesson.diagram_refs = refs
            db.add(lesson)
            changed += 1
            print(f"  [ok] day {day}: attached {fname} -> {lesson.slug}")
        db.commit()
        print(f"Attached diagrams to {changed} lesson(s).")
    finally:
        db.close()


if __name__ == "__main__":
    run()
