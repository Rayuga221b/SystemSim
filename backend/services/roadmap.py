"""Read-side helpers for the roadmap.

Routes stay thin (project rule): they call these, which own the DB queries and
the module-grouping / prev-next sequencing logic. The curriculum manifest
(data/roadmap_curriculum.json) defines module order + membership; lesson bodies
live in the DB (roadmap_lessons).
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from models.roadmap_lesson import RoadmapLesson

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


@lru_cache(maxsize=1)
def curriculum() -> dict[str, Any]:
    return json.loads((DATA_DIR / "roadmap_curriculum.json").read_text(encoding="utf-8"))


def _reading_order(cur: dict[str, Any]) -> list[int]:
    """Flat day sequence in curriculum order — the canonical prev/next path."""
    order: list[int] = []
    for mod in cur["modules"]:
        order.extend(mod["days"])
    return order


def module_of(day: int) -> dict[str, Any] | None:
    for mod in curriculum()["modules"]:
        if day in mod["days"]:
            return mod
    return None


def overview(db: Session) -> dict[str, Any]:
    """Module-grouped list of published lessons + top-level meta.

    Shape is built for the sidebar and the overview page: modules in curriculum
    order, each with its published lessons as lightweight cards.
    """
    cur = curriculum()
    published = {
        l.day: l for l in db.execute(
            select(RoadmapLesson).where(RoadmapLesson.published.is_(True))
        ).scalars()
    }

    modules = []
    total = 0
    for mod in cur["modules"]:
        cards = [published[d].card() for d in mod["days"] if d in published]
        total += len(cards)
        modules.append({
            "id": mod["id"],
            "label": mod["label"],
            "blurb": mod["blurb"],
            "color": mod["color"],
            "lessons": cards,
            "lesson_count": len(cards),
        })

    return {
        "title": cur["title"],
        "subtitle": cur["subtitle"],
        "note": cur.get("note"),
        "total_lessons": total,
        "modules": modules,
    }


def get_lesson(db: Session, slug: str) -> dict[str, Any] | None:
    lesson = db.execute(
        select(RoadmapLesson).where(
            RoadmapLesson.slug == slug, RoadmapLesson.published.is_(True)
        )
    ).scalar_one_or_none()
    if lesson is None:
        return None

    # prev/next along the curriculum reading order, skipping unpublished days.
    order = _reading_order(curriculum())
    published_days = {
        d for (d,) in db.execute(
            select(RoadmapLesson.day).where(RoadmapLesson.published.is_(True))
        )
    }
    seq = [d for d in order if d in published_days]
    try:
        i = seq.index(lesson.day)
    except ValueError:
        i = -1

    def _sib(day: int | None) -> dict[str, Any] | None:
        if day is None:
            return None
        sib = db.execute(
            select(RoadmapLesson).where(RoadmapLesson.day == day)
        ).scalar_one_or_none()
        return {"slug": sib.slug, "title": sib.title, "day": sib.day} if sib else None

    prev_day = seq[i - 1] if i > 0 else None
    next_day = seq[i + 1] if 0 <= i < len(seq) - 1 else None

    mod = module_of(lesson.day)
    detail = lesson.detail()
    detail["module_label"] = mod["label"] if mod else lesson.module
    detail["module_color"] = mod["color"] if mod else "#9B85FF"
    detail["prev"] = _sib(prev_day)
    detail["next"] = _sib(next_day)
    return detail
