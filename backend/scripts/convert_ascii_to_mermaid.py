"""One-off: replace ASCII box-drawing diagrams in already-ingested lessons with
Mermaid diagrams (so they render as real, styled flowcharts).

Future lessons emit Mermaid directly (the ingest prompt was updated), so this
only fixes the handful ingested before that change. Idempotent: skips a lesson
that no longer has an ASCII fence. Matches the fenced block that contains
box-drawing characters and swaps in the authored Mermaid for that day.

Run:  python -m scripts.convert_ascii_to_mermaid
"""
from __future__ import annotations

from dotenv import load_dotenv

# Standalone script — see docs/INCIDENTS.md #3: without this, DATABASE_URL
# (Neon) isn't visible and db.session silently falls back to empty local
# SQLite instead of erroring. Must precede the db.session import.
load_dotenv()

import re  # noqa: E402

from sqlalchemy import select  # noqa: E402

from db.session import SessionLocal  # noqa: E402
from models.roadmap_lesson import RoadmapLesson  # noqa: E402

# day -> replacement mermaid fenced block (authored to match each lesson's flow)
MERMAID: dict[int, str] = {
    7: """```mermaid
flowchart TD
    A([Evaluate data characteristics]) --> B{Needs ACID<br/>transactions?}
    B -- Yes --> R[(Relational DB<br/>Postgres · MySQL · CockroachDB)]
    B -- No --> C{Massive write throughput<br/>+ horizontal scale?}
    C -- Yes --> W[(Wide-Column NoSQL<br/>Cassandra · ScyllaDB)]
    C -- No --> D{Flexible schema<br/>+ documents?}
    D -- Yes --> DOC[(Document Store<br/>MongoDB · DynamoDB)]
    D -- No --> E{Sub-ms latency<br/>for transient data?}
    E -- Yes --> KV[(In-Memory KV<br/>Redis · Memcached)]
    E -- No --> F{Complex relationship<br/>mapping?}
    F -- Yes --> G[(Graph DB<br/>Neo4j)]
```""",
    10: """```mermaid
flowchart LR
    subgraph BEFORE["Without coalescing — N duplicate queries"]
      a1[Req 1] --> d1[(DB)]
      a2[Req 2] --> d1
      a3[Req 3] --> d1
    end
    subgraph AFTER["With coalescing — one shared query"]
      b1[Req 1] --> K{Coalescing<br/>layer}
      b2[Req 2] --> K
      b3[Req 3] --> K
      K -- single query --> d2[(DB)]
    end
```""",
    29: """```mermaid
flowchart TD
    U([User]) --> L1[Edge CDN<br/>caching · DDoS protection]
    L1 --> L2[Network Load Balancer<br/>TCP/UDP · SSL]
    L2 --> L3[API Gateway<br/>auth · rate limiting · routing]
    L3 --> MS[Microservices<br/>User · Billing · Search]
```""",
    # 2026-07-27: qwen (Groq ingest) emitted ASCII despite the Mermaid prompt
    # rule in two lessons — same fix path as the pre-prompt-change days above.
    40: """```mermaid
flowchart TD
    R[com.myapp] --> O[orders/]
    R --> I[inventory/]
    R --> S[shared/<br/>logging · config]
    O --> OA[api/<br/>public interfaces]
    O --> OD[domain/<br/>core business logic]
    O --> OAP[application/<br/>use cases]
    O --> OI[infrastructure/<br/>DB · external integrations]
    I --> IA[api/]
    I --> ID[domain/]
    I --> IAP[application/]
    I --> II[infrastructure/]
```""",
    # Day 76 is a 64-bit field layout — no Mermaid diagram type fits a bit
    # map, so the replacement is a table (the dict value is just markdown).
    76: """| Field | Bits | Purpose |
|---|---|---|
| Sign bit | 1 | Always 0 — keeps the ID a positive number |
| Timestamp | 41 | Milliseconds since a custom epoch |
| Machine ID | 10 | Which generator node produced it (up to 1,024 nodes) |
| Sequence | 12 | Per-millisecond counter (4,096 IDs per ms per node) |""",
}

# a fenced block (any/no language) that contains box-drawing characters
_FENCE = re.compile(r"```[a-zA-Z]*\n.*?```", re.S)
_BOX = set("│├└┌┐─▶▼┼┘")


def run() -> None:
    db = SessionLocal()
    changed = 0
    try:
        for day, mermaid in MERMAID.items():
            lesson = db.execute(
                select(RoadmapLesson).where(RoadmapLesson.day == day)
            ).scalar_one_or_none()
            if lesson is None:
                print(f"  [skip] day {day}: not ingested")
                continue
            body = lesson.body_md

            def _swap(m: re.Match) -> str:
                block = m.group(0)
                return mermaid if (_BOX & set(block)) else block

            new_body, n = _FENCE.subn(_swap, body)
            if n == 0 or new_body == body:
                print(f"  [skip] day {day}: no ASCII fence found")
                continue
            lesson.body_md = new_body
            db.add(lesson)
            changed += 1
            print(f"  [ok] day {day}: ASCII -> mermaid ({lesson.slug})")
        db.commit()
        print(f"Converted {changed} lesson(s).")
    finally:
        db.close()


if __name__ == "__main__":
    run()
