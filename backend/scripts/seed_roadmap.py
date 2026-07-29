"""Seed the Foundations module with original, hand-authored lessons.

WHY this exists alongside services/roadmap_ingest.py: the ingest pipeline needs
ANTHROPIC_API_KEY to transform source material into original lessons. This seed
lets the roadmap run end-to-end with real, published content with no key — the
Foundations lessons here are written from scratch (industry-standard concepts in
SystemSim's own voice), so they double as the reference quality bar for what the
pipeline should produce for the remaining modules.

Run:  python -m scripts.seed_roadmap
Idempotent: upserts by `day`.
"""
from __future__ import annotations

from dotenv import load_dotenv

# Standalone script — see docs/INCIDENTS.md #3: without this, DATABASE_URL
# (Neon) isn't visible and db.session silently falls back to empty local
# SQLite instead of erroring — this script additionally calls create_all(),
# so the bug would have silently CREATED tables on the wrong database too.
# Must precede the db.session import.
load_dotenv()

import re  # noqa: E402

from sqlalchemy import select  # noqa: E402

from db.base import Base  # noqa: E402
from db.session import SessionLocal, engine  # noqa: E402
import models  # noqa: F401,E402 register metadata
from models.roadmap_lesson import RoadmapLesson  # noqa: E402
from services.roadmap import module_of  # noqa: E402

ATTRIBUTION = (
    "Original lesson written for SystemSim. Topic and sequencing informed by the "
    "“System Design Interview Preparation Series” by Sunchit Dudeja; all text is "
    "our own and concepts are industry-standard."
)


def _slug(day: int, title: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:60].strip("-")
    return f"day-{day}-{base}"


# ── Foundations module lessons (days 1–6, 22) ─────────────────────────────────
LESSONS: list[dict] = [
    {
        "day": 1,
        "title": "Why System Design Matters",
        "subtitle": "Interviews test whether you can reason about systems, not just write functions.",
        "summary": "What system design interviews really measure, and why every company past a certain size cares.",
        "reading_minutes": 5,
        "tags": ["fundamentals", "interviews", "mindset"],
        "body_md": """Writing correct code gets you in the door. Designing a system that stays correct while millions of people hammer it is a different skill — and it's the one senior interviews are built to test.

## The shift from feature to system

Early in a career, the unit of work is a feature: take an input, return an output, make the test pass. As systems grow, the hard part stops being *"does this function work?"* and becomes *"does this still work when a thousand copies of it run at once, one data center catches fire, and traffic triples on launch day?"*

System design is the discipline of answering that second question **before** it becomes an outage.

## What the interview is actually measuring

A system design interview is deliberately open-ended. There's no single right answer, which frustrates people who want one. That ambiguity *is* the test — the interviewer is watching how you:

- Turn a vague prompt ("design a URL shortener") into concrete requirements
- Estimate scale so your choices are grounded in numbers, not vibes
- Name tradeoffs out loud instead of pretending a design has no downsides
- Recover gracefully when they poke a hole in your first idea

## Why companies weigh it so heavily

The cost of a bad architectural decision compounds. A poor variable name is a five-minute fix; a database that can't be sharded is a six-month migration. Companies pay for engineers who can see the six-month problem coming.

| Signal | What a weak answer looks like | What a strong answer looks like |
|--------|-------------------------------|---------------------------------|
| Requirements | Jumps straight to a database | Clarifies read/write ratio first |
| Scale | "It'll be fast" | "~5k writes/sec, so we need X" |
| Tradeoffs | Presents one design as perfect | "This buys availability, costs consistency" |

The table above is the whole game in miniature: interviewers reward the right-hand column because that's the behavior that prevents expensive mistakes in production.

## The mindset to carry in

Treat every prompt as a conversation, not an exam. Ask questions, state assumptions, and think in tradeoffs. You're not proving you memorized an architecture — you're proving you can be trusted to make one up responsibly.

**Try it in the sandbox:** open a blank canvas and sketch the smallest thing that could serve a single user, then ask yourself what breaks first when a million show up. That instinct — "what breaks first?" — is the muscle the rest of this roadmap trains.
""",
        "key_takeaways": [
            "System design tests reasoning under ambiguity, not recall of a canonical answer.",
            "The high-value behaviors are clarifying requirements, estimating scale, and naming tradeoffs.",
            "Bad architectural decisions compound, which is why senior interviews weigh this so heavily.",
            "Treat the prompt as a conversation: ask, assume, and think in tradeoffs out loud.",
        ],
        "interview_angle": (
            "Open every design by restating the problem and asking 2–3 clarifying questions "
            "before drawing anything. It signals seniority immediately and keeps you from "
            "designing the wrong system. Interviewers are grading the process as much as the diagram."
        ),
    },
    {
        "day": 2,
        "title": "The Qualities of a Great System",
        "subtitle": "Scalability, availability, reliability, performance, consistency, maintainability.",
        "summary": "The non-functional qualities every design is judged on — and why you can't maximize them all.",
        "reading_minutes": 7,
        "tags": ["fundamentals", "non-functional", "tradeoffs"],
        "body_md": """When someone says a system is "good," they're usually pointing at a handful of measurable qualities underneath. Naming them explicitly turns a fuzzy goal into design decisions you can defend.

## The six qualities

- **Scalability** — can it handle more load by adding resources, ideally without a rewrite?
- **Availability** — what fraction of the time is it up and answering?
- **Reliability** — does it produce correct results, and recover from faults without losing data?
- **Performance** — how fast is a single request (latency) and how many can it serve (throughput)?
- **Consistency** — do all readers see the same data at the same time?
- **Maintainability** — can a new engineer understand, change, and operate it safely?

## Availability is counted in nines

Availability is quoted as a percentage of uptime, and the jump between levels is brutal because each "nine" cuts allowed downtime by 10×.

| Availability | Downtime per year |
|--------------|-------------------|
| 99% ("two nines") | ~3.65 days |
| 99.9% | ~8.8 hours |
| 99.99% | ~52 minutes |
| 99.999% ("five nines") | ~5 minutes |

Read that table as a cost curve, not a menu: going from three nines to five nines usually means redundant everything, multi-region failover, and a much larger operations budget. Most products don't need five nines — deciding how many you actually need is itself a design choice.

## You cannot maximize everything

The uncomfortable truth is that these qualities trade against each other. Strong consistency across regions costs latency, because a write has to be acknowledged far away before it's confirmed. High availability during a network split means serving possibly-stale data. Squeezing out maximum performance often means caching, which weakens consistency.

Good design is choosing *which* qualities matter most for *this* product and spending your complexity budget there. A bank ledger and a "like" counter sit at opposite ends of the consistency axis — and both choices are correct for their context.

**Try it in the sandbox:** build a design, run it under load, and watch which quality degrades first. The simulator makes these tradeoffs concrete — you'll see latency climb the moment throughput outruns a component's capacity.
""",
        "key_takeaways": [
            "Systems are judged on scalability, availability, reliability, performance, consistency, and maintainability.",
            "Availability is measured in 'nines'; each nine cuts allowed downtime tenfold and costs disproportionately more.",
            "These qualities trade against each other — you cannot maximize all at once.",
            "Great design spends its complexity budget on the qualities this specific product needs most.",
        ],
        "interview_angle": (
            "When asked for requirements, split them into functional ('what it does') and "
            "non-functional (these six qualities). Then pick the two or three that dominate — "
            "e.g. 'this is a payments system, so consistency and reliability beat raw latency.' "
            "That framing structures the entire rest of your answer."
        ),
    },
    {
        "day": 3,
        "title": "Functional vs Non-Functional Requirements",
        "subtitle": "What the system does versus how well it has to do it.",
        "summary": "How to split a vague prompt into features and quality constraints before you design anything.",
        "reading_minutes": 5,
        "tags": ["fundamentals", "requirements"],
        "body_md": """The single most common way to fail a design interview is to start drawing boxes before you know what you're building. Splitting requirements into two buckets fixes that.

## Two kinds of requirements

**Functional requirements** describe *what the system does* — the features. For a URL shortener: create a short link, redirect to the original, maybe show click analytics.

**Non-functional requirements** describe *how well it must do those things* — the qualities from the previous lesson. For the same shortener: redirects must be fast (<100ms), the service should be highly available, and links must never point to the wrong destination.

## Why the split matters

Functional requirements decide **what components exist**. Non-functional requirements decide **how those components are built and connected**.

- "Support redirects" → you need a lookup service and a data store.
- "Redirects must be <100ms at 10k rps" → that store had better be a cache, not a cold database read.

Same feature, radically different architecture, and the difference lives entirely in the non-functional column.

## A quick worked example

> Prompt: *"Design a pastebin."*

A structured reader immediately produces:

- **Functional:** create a paste, retrieve a paste by id, optional expiry.
- **Non-functional:** read-heavy (many more reads than writes), pastes are immutable once created, needs to be available and reasonably fast globally.

That "read-heavy and immutable" observation is worth more than any box you could draw — it tells you caching will be trivially effective and you'll never fight update-consistency problems.

**Try it in the sandbox:** before building anything, write your functional and non-functional lists in a comment. Then build the design and confirm each component traces back to a requirement. Anything that doesn't is either missing a requirement or is over-engineering.
""",
        "key_takeaways": [
            "Functional requirements are the features; non-functional requirements are the quality constraints.",
            "Functional requirements decide which components exist; non-functional ones decide how they're built.",
            "Deriving read/write ratio and mutability early unlocks the biggest design decisions.",
            "Every component in your design should trace back to a stated requirement.",
        ],
        "interview_angle": (
            "Spend the first few minutes explicitly listing functional then non-functional "
            "requirements, and get the interviewer to confirm them. It scopes the problem, "
            "surfaces the read/write ratio, and gives you a checklist to design against instead "
            "of guessing what they want."
        ),
    },
    {
        "day": 4,
        "title": "Client–Server Architecture",
        "subtitle": "The request/response model underneath almost everything you'll design.",
        "summary": "The base pattern every larger architecture is an elaboration of — clients, servers, and the round trip between them.",
        "reading_minutes": 6,
        "tags": ["fundamentals", "architecture", "networking"],
        "body_md": """Before load balancers, caches, and message queues, there's one pattern everything else decorates: a client asks, a server answers. Understanding the plain version makes the elaborate versions obvious.

## The basic round trip

A **client** (browser, mobile app, another service) sends a **request**; a **server** does some work and sends back a **response**. The client initiates, the server responds — that asymmetry is the whole model.

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server
    C->>S: Request
    S->>C: Response
```

The diagram is deliberately trivial, because every "big" architecture is just this picture with more boxes inserted along the arrow. A load balancer sits on the arrow and fans requests to many servers. A cache sits on the arrow and short-circuits the trip. A CDN moves the server closer to the client. None of it changes the fundamental shape.

## Why we split client and server at all

Keeping logic and data on the server, not the client, buys you three things:

- **Control** — you can change behavior without shipping a new app to every user.
- **Trust** — clients can be tampered with; the server is the authority on what's true.
- **Sharing** — many clients hit one source of truth, so they agree with each other.

This is why "never trust the client" is a security reflex: the server must re-check anything that matters, because the request could come from a modified client.

## Where it goes next

The moment one server can't handle the load — or you can't tolerate it failing — you replicate it and put a load balancer in front. That single step (one server becomes many identical servers behind a balancer) is the foundation of horizontal scaling, and it's the subject of a later module.

**Try it in the sandbox:** drop a Client and a single Server, connect them, and simulate. Then watch what happens as you push load past what one server can take — that failure point is exactly why the rest of this roadmap exists.
""",
        "key_takeaways": [
            "Every architecture is the client→server round trip with more components inserted along the path.",
            "Servers hold logic and data for control, trust, and a shared source of truth.",
            "Never trust the client: the server must re-validate anything that matters.",
            "Replicating a server behind a load balancer is the first step of horizontal scaling.",
        ],
        "interview_angle": (
            "Start your diagram with a single client and server, then evolve it as constraints "
            "appear ('now it's too much load → add a load balancer and replicas'). Narrating the "
            "evolution shows you understand *why* each component is there, not just that it exists."
        ),
    },
    {
        "day": 5,
        "title": "Capacity Estimation",
        "subtitle": "Back-of-the-envelope math that grounds every design decision.",
        "summary": "How to turn 'a lot of users' into concrete numbers for QPS, storage, and bandwidth.",
        "reading_minutes": 7,
        "tags": ["fundamentals", "estimation", "scale"],
        "body_md": """"It needs to be scalable" is a non-statement until you attach numbers to it. Capacity estimation is the quick arithmetic that turns a vague scale into concrete requirements — and it's what separates a grounded design from hand-waving.

## The numbers you're solving for

Most estimates come down to four figures:

- **QPS** (queries per second) — request rate, split into reads and writes.
- **Storage** — how much data accumulates, per day and over years.
- **Bandwidth** — bytes per second in and out.
- **Memory** — how much of the hot data set you could hold in cache.

## Work from users to QPS

Start with a user count and an activity assumption, then divide by seconds in a day.

```
Daily active users:        100,000,000
Actions per user per day:  10
Total actions/day:         1,000,000,000
Seconds per day:           ~86,400
Average QPS:               ~11,600
Peak QPS (≈ 2–3× average): ~30,000
```

The calculation above is worth internalizing: a day has roughly 86,400 seconds, and real traffic peaks well above the average, so always design for peak, not mean. Rounding 86,400 to ~100,000 is completely acceptable — estimation rewards speed and the right order of magnitude, not decimal precision.

## Storage adds up faster than you think

If each action writes a 1 KB record and you keep them:

| Window | Records | Storage (~1 KB each) |
|--------|---------|----------------------|
| Per day | 1 billion | ~1 TB |
| Per year | ~365 billion | ~365 TB |
| 5 years | ~1.8 trillion | ~1.8 PB |

That table is the moment "just use one database" dies. Petabytes over five years is what forces sharding, tiered/cold storage, and retention policies — decisions you can only justify once you've done the arithmetic.

## Keep it rough on purpose

Round aggressively. Use powers of ten. The goal isn't an accurate forecast — it's a defensible order of magnitude that tells you *"this needs a cache and sharding"* versus *"a single Postgres box is fine."* Both are correct answers to different numbers.

**Try it in the sandbox:** set the load to your estimated peak QPS and simulate. The bottleneck the simulator highlights is the component your capacity math should have predicted — a fast feedback loop for building estimation intuition.
""",
        "key_takeaways": [
            "Estimation converts 'a lot of users' into QPS, storage, bandwidth, and memory figures.",
            "Derive QPS from users × actions ÷ ~86,400 seconds, then design for a 2–3× peak.",
            "Storage over multi-year windows is what forces sharding and tiered storage.",
            "Round aggressively — the goal is the right order of magnitude, not precision.",
        ],
        "interview_angle": (
            "Do the estimate out loud and write the numbers down. When you later say 'we need a "
            "cache here,' point at the QPS figure that justifies it. Interviewers love when a "
            "design decision is backed by arithmetic instead of assertion."
        ),
    },
    {
        "day": 6,
        "title": "Designing for Failure",
        "subtitle": "At scale, something is always broken — plan for it.",
        "summary": "Why 'assume it fails' is the default posture for every component in a distributed system.",
        "reading_minutes": 6,
        "tags": ["fundamentals", "reliability", "resilience"],
        "body_md": """A single server fails rarely enough that you can mostly ignore it. Ten thousand servers means something is failing *right now*. Distributed systems flip the default assumption from "it works" to "parts are always broken" — and good designs are built around that.

## Failure is the normal case

At scale, disks die, networks drop packets, machines reboot, and entire availability zones go dark. None of these are exotic — they're Tuesday. The design question is never *"what if this fails?"* but *"when this fails, what happens?"*

A design where any single failure takes down the whole system has a **single point of failure (SPOF)**. Hunting down and eliminating SPOFs is a core part of the job.

## The core defensive moves

- **Redundancy** — run more than one of everything, so losing one is survivable.
- **Failover** — automatically shift work to a healthy replica when one dies.
- **Health checks** — continuously detect dead instances so traffic stops flowing to them.
- **Timeouts & retries** — never wait forever on a dependency; give up and try again (carefully).
- **Graceful degradation** — shed non-essential features to keep the core alive under stress.

## Retries are a double-edged sword

Retrying a failed request sounds obviously good, but naive retries can turn a small hiccup into a full outage: every client retrying at once creates a traffic spike that keeps the struggling service down. This is a *retry storm*, and the fixes — exponential backoff, jitter, and circuit breakers — get their own lessons later in the Resilience module.

The mental model to keep: **every safety mechanism has a failure mode of its own.** Redundancy costs money, failover can flap, retries can amplify load. Designing for failure means reasoning about the failure modes of your failure handling, too.

## Blast radius

When something does break, how much does it take with it? Good designs **contain** failures — one bad shard, region, or service degrades a slice of the product, not all of it. Techniques like bulkheads and isolation (later lessons) exist entirely to shrink blast radius.

**Try it in the sandbox:** build a design with a single database, then simulate a failure of that node. Watch the whole system go dark — that's a SPOF. Add a replica and see the blast radius shrink.
""",
        "key_takeaways": [
            "At scale, component failure is constant — design for 'when', not 'if'.",
            "Eliminate single points of failure with redundancy and automatic failover.",
            "Timeouts, retries, health checks, and graceful degradation are the core defensive moves.",
            "Every safety mechanism has its own failure mode; naive retries can cause outages.",
        ],
        "interview_angle": (
            "After sketching a design, proactively point at each component and ask 'what happens "
            "when this dies?' Identifying and removing single points of failure unprompted is one "
            "of the strongest seniority signals in a design interview."
        ),
    },
    {
        "day": 22,
        "title": "The Seven Layers of a High-Level Design",
        "subtitle": "A repeatable skeleton you can hang almost any system on.",
        "summary": "A layered template — client, edge, balancing, services, caching, data, async — that structures any HLD.",
        "reading_minutes": 8,
        "tags": ["fundamentals", "architecture", "hld"],
        "body_md": """Faced with a blank canvas, experienced designers aren't improvising from nothing — they're filling in a mental template. Here's a seven-layer skeleton that fits the majority of web-scale systems, so you always have a starting structure.

## The layers, front to back

A request flows down these layers and a response flows back up:

```mermaid
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
```

| # | Layer | Job |
|---|-------|-----|
| 1 | Client | Browser / mobile / service that starts the request |
| 2 | Edge / CDN | Serve static assets and cache close to the user |
| 3 | Load balancing | Spread requests across many application instances |
| 4 | Application / services | The business logic — often many services |
| 5 | Caching | Hold hot data in memory to spare the database |
| 6 | Data stores | The durable source of truth (SQL / NoSQL / blob) |
| 7 | Async / workers | Queues and background jobs for work off the request path |

The table is the template: when you're stuck, walk the layers top to bottom and ask "does this system need something here?" Most do; some skip a layer, and *that omission is itself a design statement* worth saying out loud.

## Why layering helps

Two reasons. First, **completeness** — walking the layers stops you forgetting the CDN or the async layer under interview pressure. Second, **separation of concerns** — each layer has one job, so you can scale, cache, or replace it independently. The caching layer can change from Redis to Memcached without the application layer knowing.

## The async layer is the one people forget

Layers 1–6 handle the synchronous request path. Layer 7 is where you move anything the user shouldn't wait for: sending email, generating thumbnails, updating analytics, fanning out notifications. Pushing slow work into a queue keeps the request path fast and lets you absorb spikes.

```mermaid
flowchart LR
    req([Request]) --> app[App]
    app -- respond fast --> resp([Response])
    app -- enqueue job --> q[[Queue]]
    q --> w[Worker pool]
    w -. processes later .-> db[(Data store)]
```

The sketch above captures the core move: the app hands work to a queue and responds immediately, while a separate pool of workers drains the queue at its own pace. That decoupling is what makes a system feel fast *and* survive traffic bursts — the queue absorbs the spike instead of the user feeling it.

## Use it as a checklist, not a cage

Not every system needs all seven layers, and some need extra structure the template doesn't show. Treat it as a prompt for "what might belong here?" rather than a mandatory shape. Its value is that you never start from a truly blank page.

**Try it in the sandbox:** build a design layer by layer — client, balancer, service, cache, database, worker — and simulate at each step. You'll feel how each layer changes where the bottleneck lands.
""",
        "key_takeaways": [
            "Most web-scale systems fit a seven-layer skeleton: client, edge, balancing, services, caching, data, async.",
            "Walking the layers gives you completeness (nothing forgotten) and separation of concerns.",
            "The async/worker layer moves slow work off the request path and absorbs spikes.",
            "Treat the template as a checklist to prompt decisions, not a mandatory shape.",
        ],
        "interview_angle": (
            "Use the layers as the spine of your answer: narrate the request flowing down through "
            "them. It keeps you organized, ensures you cover caching and async work, and lets the "
            "interviewer follow your reasoning. Explicitly note any layer you deliberately skip and why."
        ),
    },
]


def run() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        for data in LESSONS:
            day = data["day"]
            mod = module_of(day)
            lesson = db.execute(
                select(RoadmapLesson).where(RoadmapLesson.day == day)
            ).scalar_one_or_none() or RoadmapLesson(day=day)

            lesson.slug = _slug(day, data["title"])
            lesson.module = mod["id"] if mod else "foundations"
            lesson.title = data["title"]
            lesson.subtitle = data["subtitle"]
            lesson.summary = data["summary"]
            lesson.reading_minutes = data["reading_minutes"]
            lesson.body_md = data["body_md"]
            lesson.key_takeaways = data["key_takeaways"]
            lesson.interview_angle = data["interview_angle"]
            lesson.tags = data["tags"]
            lesson.attribution = ATTRIBUTION
            lesson.published = True
            db.add(lesson)
            print(f"  [ok] day {day}: {lesson.slug}")
        db.commit()
        print(f"Seeded {len(LESSONS)} Foundations lessons.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
