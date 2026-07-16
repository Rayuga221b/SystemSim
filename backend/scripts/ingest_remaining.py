"""Resume roadmap ingestion — fill every non-Foundations lesson not yet published.

Convenience wrapper around services.roadmap_ingest: figures out which curriculum
days are still missing/draft and ingests just those, publishing as it goes. Safe
to run repeatedly — it only touches days that aren't published yet, so it picks
up exactly where a quota-interrupted run left off.

Foundations (days 1-6, 22) are hand-authored and deliberately skipped so their
custom diagrams aren't overwritten.

Run:  python -m scripts.ingest_remaining
(Needs GEMINI_API_KEY in backend/.env and available Gemini quota.)
"""
from __future__ import annotations

from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import select  # noqa: E402

from db.session import SessionLocal  # noqa: E402
from models.roadmap_lesson import RoadmapLesson  # noqa: E402
from services.roadmap import curriculum  # noqa: E402
from services.roadmap_ingest import ingest_days  # noqa: E402


def run() -> None:
    cur = curriculum()
    foundations = set(cur["modules"][0]["days"])
    db = SessionLocal()
    published = {
        d for (d,) in db.execute(
            select(RoadmapLesson.day).where(RoadmapLesson.published.is_(True))
        )
    }
    db.close()

    todo = [d for m in cur["modules"] for d in m["days"]
            if d not in foundations and d not in published]
    if not todo:
        print("Nothing to do — every non-Foundations lesson is published.")
        return
    print(f"Ingesting {len(todo)} remaining lesson(s): {todo}", flush=True)
    ingest_days(todo, publish=True)
    print("\nTip: run `python -m scripts.attach_diagrams` afterward to add "
          "diagrams to newly-ingested key lessons.")


if __name__ == "__main__":
    run()
