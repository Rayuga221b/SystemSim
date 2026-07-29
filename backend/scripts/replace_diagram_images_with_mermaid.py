"""One-off: replace the 7 `![]()` static-diagram image refs already baked into
ingested lesson bodies with the equivalent Mermaid text block.

Why: 7 lessons (attached via scripts/attach_diagrams.py, plus 2 hardcoded in
scripts/seed_roadmap.py) reference SVGs under static/roadmap/diagrams/ that
were hand-authored locally, never committed (gitignored as "ingest build
artifacts"), and don't exist in a fresh checkout or deploy — same failure
mode as the ASCII diagrams fixed by convert_ascii_to_mermaid.py. Both source
scripts now emit Mermaid instead of image markdown, but that only affects
future runs; this patches rows that already have the old image markdown.

Idempotent: skips a lesson whose body no longer has the old image reference.

Run:  python -m scripts.replace_diagram_images_with_mermaid
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

# day -> (old image markdown regex, replacement mermaid block)
REPLACEMENTS: dict[int, tuple[str, str]] = {
    4: (
        r"!\[[^\]]*\]\(/static/roadmap/diagrams/client-server\.svg\)",
        """```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server
    C->>S: Request
    S->>C: Response
```""",
    ),
    22: (
        r"!\[[^\]]*\]\(/static/roadmap/diagrams/seven-layers\.svg\)",
        """```mermaid
flowchart TD
    A(["Client"]) -->|request| B["Edge / CDN"]
    B -->|request| C["Load Balancing"]
    C -->|request| D["Application / Services"]
    D -->|request| E["Caching"]
    E -->|request| F[("Data Stores")]
    D -.-> G[["Async / Workers"]]
    F -.->|response| E
    E -.->|response| D
    D -.->|response| C
    C -.->|response| B
    B -.->|response| A
```""",
    ),
    13: (
        r"!\[[^\]]*\]\(/static/roadmap/diagrams/circuit-breaker-states\.svg\)",
        """```mermaid
stateDiagram-v2
    [*] --> Closed
    Closed --> Closed: request succeeds
    Closed --> Open: failure threshold exceeded
    Open --> HalfOpen: reset timeout elapses
    HalfOpen --> Closed: trial request succeeds
    HalfOpen --> Open: trial request fails
```""",
    ),
    28: (
        r"!\[[^\]]*\]\(/static/roadmap/diagrams/consistent-hashing\.svg\)",
        """```mermaid
flowchart LR
    K1["Key: user_42"] -.->|hashes onto ring, walks clockwise| N1["Node A"]
    K2["Key: user_7"] -.->|hashes onto ring, walks clockwise| N2["Node B"]
    K3["Key: user_19"] -.->|hashes onto ring, walks clockwise| N3["Node C"]
    N1 --> N2 --> N3 --> N1
```""",
    ),
    45: (
        r"!\[[^\]]*\]\(/static/roadmap/diagrams/saga-pattern\.svg\)",
        """```mermaid
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
    ),
    64: (
        r"!\[[^\]]*\]\(/static/roadmap/diagrams/database-sharding\.svg\)",
        """```mermaid
flowchart TD
    Client(["Client request"]) --> Router{"Shard Router"}
    Router -->|"shard_key % 3 == 0"| S1[("Shard 1")]
    Router -->|"shard_key % 3 == 1"| S2[("Shard 2")]
    Router -->|"shard_key % 3 == 2"| S3[("Shard 3")]
```""",
    ),
    72: (
        r"!\[[^\]]*\]\(/static/roadmap/diagrams/resilience-stack\.svg\)",
        """```mermaid
flowchart TD
    A(["Incoming request"]) --> B["Rate Limiter"]
    B --> C["Circuit Breaker"]
    C --> D["Bulkhead"]
    D --> E["Timeout"]
    E --> F["Retry"]
    F --> G["Fallback"]
    G --> H(["Response"])
```""",
    ),
}


def run() -> None:
    db = SessionLocal()
    changed = 0
    try:
        for day, (pattern, mermaid_md) in REPLACEMENTS.items():
            lesson = db.execute(
                select(RoadmapLesson).where(RoadmapLesson.day == day)
            ).scalar_one_or_none()
            if lesson is None:
                print(f"  [skip] day {day}: no lesson")
                continue
            body = lesson.body_md or ""
            new_body, n = re.subn(pattern, mermaid_md, body)
            if n == 0:
                print(f"  [skip] day {day}: no matching image ref (already fixed?)")
                continue
            lesson.body_md = new_body
            if lesson.diagram_refs:
                lesson.diagram_refs = []
            db.add(lesson)
            changed += 1
            print(f"  [ok] day {day}: replaced image ref with mermaid -> {lesson.slug}")
        db.commit()
        print(f"Replaced {changed} lesson(s).")
    finally:
        db.close()


if __name__ == "__main__":
    run()
