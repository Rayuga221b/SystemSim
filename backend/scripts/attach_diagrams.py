"""Attach hand-authored Mermaid diagrams to specific roadmap lessons.

The ingest pipeline writes lesson bodies but doesn't know about our custom
diagrams (they'd be third-party/copyright if pulled from the source). These
were originally hand-authored SVG files under static/roadmap/diagrams/ and
stitched in as `![]()` image references — but that made 7 lessons depend on
static assets that were never committed to git (gitignored as "ingest build
artifacts") and don't exist in a fresh deploy. Converted to Mermaid text
blocks instead, same fix already applied to the 2 lessons whose ingested
ASCII diagrams didn't survive (see scripts/convert_ascii_to_mermaid.py) —
Mermaid travels as text in body_md and renders client-side, no file
dependency at all.

Idempotent: skips a lesson whose body already contains the diagram. Insertion
point is right after the lesson's opening hook paragraph, so the visual lands
near the top. Stitched in by DAY number (slugs are model-generated and not
stable).

Run:  python -m scripts.attach_diagrams
"""
from __future__ import annotations

from dotenv import load_dotenv

# Standalone script — nothing else loads backend/.env here, so DATABASE_URL
# (the Neon connection string) wouldn't be visible without this; silently
# falls back to the empty local SQLite file instead of erroring. Same bug
# already hit and documented in docs/INCIDENTS.md #3 — must run before
# importing db.session, which reads DATABASE_URL at import time.
load_dotenv()

from sqlalchemy import select  # noqa: E402

from db.session import SessionLocal  # noqa: E402
from models.roadmap_lesson import RoadmapLesson  # noqa: E402

# day -> mermaid fenced block (authored to match each lesson's concept)
DIAGRAMS: dict[int, str] = {
    13: """```mermaid
stateDiagram-v2
    [*] --> Closed
    Closed --> Closed: request succeeds
    Closed --> Open: failure threshold exceeded
    Open --> HalfOpen: reset timeout elapses
    HalfOpen --> Closed: trial request succeeds
    HalfOpen --> Open: trial request fails
```""",
    28: """```mermaid
flowchart LR
    K1["Key: user_42"] -.->|hashes onto ring, walks clockwise| N1["Node A"]
    K2["Key: user_7"] -.->|hashes onto ring, walks clockwise| N2["Node B"]
    K3["Key: user_19"] -.->|hashes onto ring, walks clockwise| N3["Node C"]
    N1 --> N2 --> N3 --> N1
```""",
    45: """```mermaid
sequenceDiagram
    participant O as Orchestrator
    participant A as Order Service
    participant B as Payment Service
    participant C as Inventory Service
    O->>A: Create order
    A-->>O: OK
    O->>B: Charge payment
    B-->>O: OK
    O->>C: Reserve inventory
    C-->>O: Failed
    Note over O: Failure — run compensations in reverse
    O->>B: Refund payment
    O->>A: Cancel order
```""",
    64: """```mermaid
flowchart TD
    Client(["Client request"]) --> Router{"Shard Router"}
    Router -->|"shard_key % 3 == 0"| S1[("Shard 1")]
    Router -->|"shard_key % 3 == 1"| S2[("Shard 2")]
    Router -->|"shard_key % 3 == 2"| S3[("Shard 3")]
```""",
    72: """```mermaid
flowchart TD
    A(["Incoming request"]) --> B["Rate Limiter"]
    B --> C["Circuit Breaker"]
    C --> D["Bulkhead"]
    D --> E["Timeout"]
    E --> F["Retry"]
    F --> G["Fallback"]
    G --> H(["Response"])
```""",
}


def _insert_after_hook(body: str, diagram_md: str) -> str:
    """Place the diagram after the first paragraph (the opening hook)."""
    marker = "\n\n"
    i = body.find(marker)
    if i == -1:
        return f"{diagram_md}\n\n{body}"
    return body[: i + len(marker)] + diagram_md + "\n\n" + body[i + len(marker):]


def run() -> None:
    db = SessionLocal()
    changed = 0
    try:
        for day, diagram_md in DIAGRAMS.items():
            lesson = db.execute(
                select(RoadmapLesson).where(RoadmapLesson.day == day)
            ).scalar_one_or_none()
            if lesson is None:
                print(f"  [skip] day {day}: no lesson (not ingested yet)")
                continue
            if diagram_md in (lesson.body_md or ""):
                print(f"  [skip] day {day}: already has the diagram")
                continue
            lesson.body_md = _insert_after_hook(lesson.body_md, diagram_md)
            db.add(lesson)
            changed += 1
            print(f"  [ok] day {day}: attached mermaid diagram -> {lesson.slug}")
        db.commit()
        print(f"Attached diagrams to {changed} lesson(s).")
    finally:
        db.close()


if __name__ == "__main__":
    run()
