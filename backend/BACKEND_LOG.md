# BACKEND_LOG — SystemSim

A running log of everything built in `backend/`, how it works, and why each
decision was made. Written so Satyam can own every line in an interview.
Append new entries at the bottom; never rewrite history.

---

## 2026-07-07 — The big build (engine, scoring, content, full API)

Context: the "Satyam writes the engine by hand" rule was explicitly lifted
today. Everything below was built to industry grade in one pass, with this log
as the design walkthrough that keeps the code explainable.

### 1. Simulation engine — `engine/`

Three files, three responsibilities:

| File | Owns |
|---|---|
| `components.py` | The 14 component strategies + config defaults |
| `simulation.py` | Graph building, traversal, failure injection, output assembly |
| `tradeoffs.py`  | The 0–100 tradeoff heuristics |

**Strategy pattern (`components.py`).** Every component is a class with one
method: `process(load: WorkLoad, ctx: NodeContext) -> ProcessResult`. The
traversal looks the type up in `REGISTRY` and calls it — it never
special-cases a component (two documented exceptions below). Adding a 15th
component = one new class + one REGISTRY entry, zero traversal edits.

**Load is a pair, not a number.** `WorkLoad(read_rps, write_rps)` — the split
happens once at the clients from the request's `workload.read_pct` (default
80). This single decision is what makes the interesting semantics possible:

- **Cache/CDN** absorb `hit_rate%` of *reads only*; writes pass through.
  Absorbed traffic counts as *served* (the user got a response).
- **SQL DB** sends writes to the primary only (`primary_capacity`) and fans
  reads across replicas (`replicas × read_capacity_per_replica`). Utilization
  is the *worse* of the two paths — either one saturating is an incident.
  With `replicas=0` the primary serves reads at one replica's rate
  (a lone primary still answers SELECTs — documented simplification).
- **Search index** has separate read capacity and a much smaller write limit —
  the classic "indexing lags under write pressure" behavior.

`WorkLoad` is a frozen dataclass on purpose: load values are combined and
scaled constantly as they flow through the graph; immutability eliminates
aliasing bugs where two nodes share and mutate one object.

**ProcessResult accounting invariant.** Every strategy buckets its incoming
load into exactly three outcomes: `passed` (forwarded downstream), `absorbed`
(served here — cache hits, queue buffering), `dropped` (rejected/lost).
`passed + absorbed + dropped == incoming`, always. Achieved throughput =
requested − Σ dropped (clamped) — so a lagging queue *doesn't* hurt the
headline number (nothing was lost, it's just late), but a rate limiter does.

**Traversal (`simulation.py`).** NetworkX DiGraph, processed in topological
order (a multi-source BFS over a DAG collapses to exactly this) so every node
sees its complete incoming load before it runs — no partial updates or
re-visits. Two topology rules live in the traversal because they're routing
concerns (the traversal owns the edges):

1. **Load-splitting rule:** a `load_balancer` divides its output *evenly*
   across successors; every other node sends its *full* output to *each*
   successor. Fan-out from an app server to a cache and a queue means both see
   the whole stream — "every request touches both", the common real-world
   meaning of those edges. Want traffic divided? Put a load balancer there.
   That's the teaching point.
2. **Queue drain discovery:** a `message_queue` needs to know how fast its
   downstream workers drain (`Σ instances × consume_rps`, respecting their
   failure modes). If produce > drain, the queue *buffers* the excess (absorbed,
   not dropped), warns about growing lag, and goes to `warning` — the spec's
   "shows lag" behavior. No workers downstream → dumb buffer passthrough.

**Edge cases:** cycles are detected and broken edge-by-edge with a warning
(never an infinite loop); disconnected nodes report healthy-but-idle with a
warning; multiple client nodes split the requested load evenly between them;
dangling edges (mid-edit canvas states) are skipped with a warning instead of
failing the sim.

**Failure injection** mutates the node's *effective config* before its
strategy runs, so strategies stay failure-agnostic: `node_crash` short-circuits
(all load lost, status `failed`), `slow_node` ×10 latency,
`cache_miss_spike` → hit_rate 10, `queue_backup` → drain ×0.5,
`replication_lag` → stale-read warning (freshness problem, not throughput),
`traffic_spike` → global ×2 on requested load.

**Statuses:** utilization <80% `healthy`, 80–100% `warning`, >100%
`overloaded`; `failed` only via crash injection. Bottlenecks = overloaded and
failed nodes, hottest first. Critical-path latency = longest root-to-sink
path (DP over topo order) — deliberately the *worst case* path (e.g. the
cache-miss path), because that's the latency you design around.

**Output** matches `docs/spec.md` exactly, plus one extension:
`node_metrics: {id: {in_rps, out_rps, capacity_rps, utilization_pct,
latency_ms}}` — the frontend needs per-node numbers for the properties panel,
node badges, and bottleneck cards. `capacity_rps: 0` means unlimited.

### 2. Tradeoff heuristics — `engine/tradeoffs.py`

0–100 scores derived from the graph shape + sim outcome: availability (LB
present, replicas, multi-instance, single-point-of-failure penalties),
consistency (charged for caches, replication lag, NoSQL eventual consistency),
scalability (headroom at current load + horizontal primitives present),
latency (scored against the critical path), cost and complexity as
low/medium/high chips (component count, instance totals, distinct types).
Heuristics are documented inline per function.

### 3. Scoring — `services/scoring.py`

100-point rubric, weights chosen so that *using the right pieces* and
*surviving the load* both matter:

- **35 pts** required components (proportional; each missing type is a
  specific `missing` feedback line)
- **15 pts** connectivity sanity (client present, traffic actually reaches a
  storage layer, nothing floating off the path)
- **40 pts** simulated performance — we *run the user's graph* at the
  challenge's `load_rps`/`workload`: 20 throughput ratio, 10 no
  overloaded/failed nodes (−5 each, with per-node metric-based feedback),
  10 latency budget
- **10 pts** bonus concepts (e.g. cache on a read-heavy problem)

Feedback is three buckets (`missing` / `weak` / `good`) with concrete numbers
("takes 4,000 write RPS but handles 1,000") the UI renders directly. Pure
functions, no I/O — the route persists the attempt if the caller is signed in.

### 4. Content — `data/challenges.json`, `data/case_studies.json`

Content is data, not code (project decision — authored without redeploys).
8 challenges (URL shortener → flash sale, each with requirements, traffic
profile, progressive hints, required/bonus components, and a hidden
`reference_graph`), 7 case studies (Discord, Twitter, Slack, Shopify,
Instagram, Netflix, Prime Video — each with problem/solution prose,
scale-context stats, lessons, and a simulatable `starter_graph` reproducing
the *before* state). `services/content.py` loads both with `lru_cache`.

**Editorial safety net in CI:** tests assert every reference graph simulates
clean at its own load *and scores ≥80 on its own challenge*, and every starter
graph at least runs. Bad content fails the build, not the demo.

### 5. API surface — `routes/`

Routes stay thin (parse → service/engine → shape). Full map:

| Route | Auth | Notes |
|---|---|---|
| `POST /simulate` | — | Pydantic validates (≥1 client, ≤60 nodes); engine `ValueError` → 422 |
| `GET /challenges`, `GET /challenges/{slug}` | — | `reference_graph` and `bonus_components` never leave the server |
| `POST /challenges/{slug}/attempt` | optional | anonymous = score only; signed-in = persist attempt |
| `GET /challenges/{slug}/attempts` | required | own attempts for one challenge |
| `GET /me/attempts` | required | dashboard history, titles resolved from content |
| `GET /casestudies`, `GET /casestudies/{slug}` | — | published only; list = card summaries |
| `/designs` CRUD | required | see ownership note below |
| `GET /auth/me` + register/login | — | bcrypt + HS256 JWT (pre-existing) |
| `POST /ai/explain`, `POST /ai/mentor` | — | 503 without `ANTHROPIC_API_KEY` |

**Ownership isolation:** every `designs`/`challenge_attempts` query filters by
the resolved `user_id` — the app layer *is* the security boundary (no RLS
backstop anymore). Cross-user access returns 404, not 403, so design IDs don't
leak existence. `get_current_user_optional` (in `dependencies.py`) powers the
anonymous-but-persist-when-signed-in attempt flow.

### 6. AI — `services/claude.py`

One place talks to the Claude API; model id from env (`CLAUDE_MODEL`, default
`claude-sonnet-4-20250514` per spec). Two context-scoped functions — 
`explain_simulation(graph, result)` (why it bottlenecks + exactly one concrete
fix, <200 words) and `case_study_mentor(case_study, question)` (grounded in
that study only). No key → `AIUnavailable` → 503 → the frontend shows a
friendly "not configured" note. The product degrades gracefully.

### 7. Persistence decisions

- **SQLite dev fallback** (`db/session.py`): `DATABASE_URL` defaults to
  `sqlite:///./systemsim.db` so `uvicorn main:app` works with zero
  infrastructure. Postgres stays the production target.
- **Schema creation:** `Base.metadata.create_all` in the FastAPI lifespan
  covers SQLite; Postgres deployments run Alembic migrations (create_all is a
  no-op on existing tables). New column today: `challenge_attempts.feedback`
  (JSON) — an Alembic revision is needed before the next Postgres deploy.
- **JWT secret fail-soft:** missing `JWT_SECRET` now generates an ephemeral
  dev secret with a loud warning instead of crashing startup. Production must
  set it (tokens die on every restart otherwise).

### 8. Auth (pre-existing, for completeness)

bcrypt (passlib) hashing; HS256 JWT access token, 60-min expiry, `sub` = user
id, sent as `Authorization: Bearer`. No refresh token yet (planned). Models:
`users`, `designs`, `challenge_attempts` (UUID string PKs).

### 9. Tests — `tests/`

46 tests, all green (`venv/Scripts/python -m pytest tests/ -q`):

- `test_engine.py` — one test per documented rule: cache read-absorption math,
  LB split vs full fan-out, SQL write bottleneck, rate-limit capping, queue
  lag (buffered ≠ dropped), crash/spike/slow/replication-lag injection,
  disconnected nodes, cycle breaking.
- `test_content_and_scoring.py` — the editorial safety net + rubric checks
  (reference graphs score ≥80, empty graph scores ≤40 with `missing` feedback).
- `test_api.py` — auth roundtrip (409 duplicate, 401 bad login), designs CRUD
  with cross-user 404 isolation, simulate happy/422 paths, challenge attempt
  anonymous vs persisted, `/me/attempts`, AI 503 fallback.

Tests run against a throwaway SQLite file; no Docker, no API key needed.

---

## 2026-07-08 — Competitive pass (inspired by systemdesignschool.io)

**Context:** reviewed System Design School — strong at structured curriculum
("primer" with a decomposition framework) and official solution walkthroughs;
weak at interactivity (their practice is text/form-based; nothing runs). We
adopted their two best ideas in a way that keeps our simulate-first identity.

- **`GET /challenges/{slug}/solution`** — returns the reference graph +
  load/workload + a study note. DECISION: ungated server-side (it's teaching
  material, not an exam key); the *frontend* only surfaces it after a scored
  attempt, preserving the try-first-then-compare learning loop. Tested
  (test_api.py::test_solution_endpoint_returns_reference_graph). Rationale:
  System Design School shows official solutions and it's clearly the right
  pedagogy — but loading ours ONTO THE CANVAS beats reading a write-up: the
  user can simulate the reference, inject failures into it, and try to beat
  its tradeoff profile.
- **Scoring rubric tightened** (2026-07-08, same file `services/scoring.py`):
  performance points now require traffic to actually flow through the design —
  a disconnected "shopping list" of correct components previously scored 80
  because nothing dropped. Regression test added.
- Frontend gained a `/learn` curriculum page (chapters in
  `frontend/src/data/chapters.js`) — no backend surface, noted here only
  because content strategy now spans both: challenges teach by doing, /learn
  teaches the method, case studies teach by incident.

### Open items

- [ ] Alembic revision for `challenge_attempts.feedback` (before Postgres deploy)
- [ ] Refresh tokens / httpOnly cookie auth
- [ ] `POST /admin/ingest` case-study scraper pipeline (stub; content is curated JSON for now)
- [ ] Rate limiting on `/simulate` and `/ai/*` before public deploy
- [ ] `simulation_logs` table (spec) — deliberately skipped until there's a use for it

---

## 2026-07-16 — Learn Roadmap (long-form guided track)

Added a 76-lesson "System Design Roadmap" reachable from the Learn page
(`/learn/roadmap`, `/learn/roadmap/:slug`). A docs-style reader (sidebar +
prose + prev/next), populated from the DB.

### 1. Content lives in the DB, not JSON — the deliberate exception

Challenges/case-studies are JSON (project rule). The roadmap is **not**: it's
76+ long-form lessons that will grow and want per-lesson queries, published
state, and later per-user progress. New table `roadmap_lessons`
(`models/roadmap_lesson.py`) — `day` (unique), `slug`, `module`, `title`,
`summary`, `body_md`, `key_takeaways` (JSON), `interview_angle`, `tags`,
`diagram_refs`, `published`, timestamps. Created via `create_all` (SQLite dev)
like the rest; Alembic revision still owed before Postgres (see checklist).

### 2. Copyright-safe ingestion — same principle as case studies

Source material is a third-party series (Sunchit Dudeja) with **no license**
(all rights reserved). So we do NOT store/serve it verbatim. `services/
roadmap_ingest.py` fetches a source doc as *reference only* (cached to a
gitignored dir, never committed) and asks Claude to produce an **original,
restructured** lesson — mirrors the existing "AI-structured summaries, never
raw scraped HTML" decision. Run: `python -m services.roadmap_ingest --days 1-7
--publish` (needs `ANTHROPIC_API_KEY`; degrades to AIUnavailable otherwise).

### 3. Curriculum manifest vs. content

`data/roadmap_curriculum.json` = ordering/grouping config (11 modules, day→
module map, accent colors). It's presentation config, not served content, so
JSON is fine. `services/roadmap.py` joins it with DB rows for the grouped
overview and computes prev/next along the reading order (skipping unpublished).

### 4. Routes + static

`routes/roadmap.py`: `GET /roadmap` (module-grouped cards) and
`GET /roadmap/{slug}` (full lesson + prev/next). Published-only. Mounted
`/static` for pre-rendered diagram SVGs (ingest artifact; dir gitignored).

### 5. Seeded content

`scripts/seed_roadmap.py` publishes the 7 Foundations lessons as hand-authored
originals (no API key needed) — also the quality bar for pipeline output.
Remaining 10 modules show "soon" until ingested.

### 6. Provider swap for ingest — Gemini, not Claude (2026-07-16)

We had a Gemini key, not an Anthropic one. DECISION: the roadmap ingest uses
**Gemini** via a small isolated provider (`services/gemini.py`, REST over
urllib, no new SDK). The in-app AI features (explain/mentor) stay on Claude —
this swap is scoped to the one-time content batch only. Model id lives in ONE
place: `GEMINI_MODEL` env (currently `gemini-3.5-flash`; `gemini-2.5-flash` is
blocked for new API projects). Two things that mattered:
  - **Structured output** (`responseSchema` in generationConfig) — without it,
    the big multi-line `body_md` string comes back with raw newlines and breaks
    `json.loads`. The schema guarantees valid, escaped JSON.
  - **Retry/backoff** on 429/500/503 in `_post` — the free tier throttles hard.

Diagrams: authored by hand as original SVGs under `static/roadmap/diagrams/`
(the source's `.excalidraw` files are third-party/unlicensed, same as the text),
stitched into lessons by day via `scripts/attach_diagrams.py`.

INGEST STATUS (2026-07-16): 31/76 published — Foundations + Databases + Caching
+ Traffic/APIs complete, Messaging 1/7, rest pending. Batch stopped on Gemini's
**daily free-tier quota** (HTTP 429, not a bug). Resume with
`python -m scripts.ingest_remaining` once quota resets (~24h) or billing is on;
it only touches unpublished days, then run `attach_diagrams` again.

TODO:
- [ ] Finish ingest: 45 lessons remain (`python -m scripts.ingest_remaining`) — blocked on Gemini daily quota
- [ ] Diagram pre-render step (.excalidraw → SVG) — superseded: we author original SVGs instead
- [ ] Alembic revision for `roadmap_lessons` before Postgres deploy
- [ ] Optional: per-user lesson progress table (currently localStorage only)
