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

---

## 2026-07-25 — Simulation explainer moved to Gemini (structured output)

Context: `POST /ai/explain` shipped on Claude in the big build, but the
Anthropic key was never real — the feature 503'd (or worse, 500'd against the
placeholder key) since day one. Satyam's call today: run the explainer on the
**Gemini provider we already have** (`services/gemini.py`, the ingest
provider). This explicitly overrides the earlier "in-app AI stays Claude"
note; the case-study mentor stays on Claude untouched. Recorded in CLAUDE.md
Decisions; full architecture write-up in `docs/AI_INTEGRATION.md`.

### 1. New service — `services/ai_explain.py`

The route stays thin; all logic lives here. Three decisions worth owning:

- **Structured output, not prose.** The old Claude version returned a text
  blob. The Gemini version uses controlled generation (`responseSchema`, same
  technique the roadmap ingest proved out) so the response is
  guaranteed-parseable JSON: `summary`, `bottlenecks[{node_id, label, why,
  fix}]`, `suggested_fixes[]`. The frontend renders sections and per-node
  cards instead of a wall of text, and `propertyOrdering` makes the model
  commit to the summary verdict before arguing details.
- **Compact context serialization.** The prompt gets a line-per-node text form
  (`id | type | label | config`) plus edges as `source -> target` — not raw
  canvas JSON (no positions, no React Flow noise). The sim result is slimmed
  to statuses, bottleneck list, metrics for *non-healthy nodes only*,
  throughput, warnings, tradeoffs. Context-scoped as always (project rule) and
  token cost stays flat even at the 60-node graph cap.
- **Off-contract output → 503, not garbage.** Unparseable JSON or a
  wrong-shape response raises `AIUnavailable` — the UI shows its friendly
  fallback rather than half-rendering. `_validate` also drops malformed
  bottleneck entries and caps fixes at 3.

Gotcha found while curling the live endpoint: on Gemini 2.5+/3.5, internal
"thinking" tokens count against `maxOutputTokens` — 1024 truncated real
responses mid-JSON. Cap is 4096 now (the visible JSON stays small; the cap
only guards runaway cost).

### 2. Route + provider seam — `routes/ai.py`, `services/gemini.py`

`/ai/explain` now imports `services.ai_explain` and catches Gemini's
`AIUnavailable`; `/ai/mentor` still imports `services.claude` and catches
Claude's. Two exception classes on purpose — the providers stay fully
isolated, and each maps to the same 503 contract. `services/gemini.py` needed
zero new code (its `generate_json` was already general: schema optional);
only its "ingest-only" docstring changed.

### 3. Tests — `tests/test_api.py`

The old `test_ai_returns_503_without_api_key` was env-fragile: conftest pops
`ANTHROPIC_API_KEY` before importing `main`, but `load_dotenv()` in main.py
re-loads the placeholder key from `.env`, so the explain call reached the
Anthropic SDK and 500'd. Replaced with four robust tests that never touch a
provider: explain 503 (monkeypatch-delete `GEMINI_API_KEY`), mentor 503
(delete `ANTHROPIC_API_KEY`), a mocked-Gemini success path asserting the
structured shape AND that the prompt is context-scoped (graph + statuses in
it, schema passed), and malformed-model-output → 503. Suite: 51 passed.

### Open items

- [ ] Rate limiting on `/ai/*` before public deploy (unchanged, now more
      urgent — explain calls burn free-tier Gemini quota)
- [ ] Frontend mentor UI still pending an Anthropic key (mentor stays 503
      until then — graceful)

---

## 2026-07-26 — Groq provider: explainer -> llama-3.3-70b, ingest -> qwen3.6-27b

DECISION (Satyam): both Gemini-backed features move to Groq — the key with
usable quota. `/ai/explain` runs on `llama-3.3-70b-versatile`, the roadmap
ingest on `qwen/qwen3.6-27b`. Mentor stays on Claude. `services/gemini.py`
is untouched and unused — swap-back is a one-import change, as designed.

### 1. New provider — `services/groq.py`

OpenAI-compatible REST (`api.groq.com/openai/v1/chat/completions`) over
urllib, no SDK — a deliberate mirror of `services/gemini.py` so
`generate_json(system, user, *, model, max_tokens, response_schema)` is
signature-identical and feature services swap with one import line. Model
ids in ONE place: `GROQ_MODEL` / `GROQ_INGEST_MODEL` env vars.

Groq specifics learned the hard way (each observed live):

- **Cloudflare 403 (error 1010)** on urllib's default `Python-urllib/x.y`
  User-Agent — provider sends an explicit UA.
- **JSON mode, not schema enforcement:** Groq's schema-enforced structured
  outputs only cover GPT-OSS models; llama/qwen get
  `response_format: {"type": "json_object"}` (guarantees syntax) with the
  schema injected into the system prompt (Gemini-only `propertyOrdering`
  keys stripped). Caller validation stays the shape backstop — unchanged.
- **429 carries `retry-after` seconds** — honored (capped at 120s),
  exponential backoff otherwise; also retries 500/502/503.
- **qwen is a reasoning model:** thinking burned the whole completion budget
  and Groq's JSON-mode validation failed on the truncated result
  (`json_validate_failed`, empty generation). Fix: `reasoning_effort:
  "none"` on ingest calls; provider also strips any `<think>` prefix.

### 2. Ingest token budgeting — `services/roadmap_ingest.py`

Free-tier qwen caps at **8k tokens/min, checked at request time against
`prompt + max_completion_tokens`** — the old 16k output budget alone drew an
HTTP 413 (never retryable, unlike 429). `transform()` now budgets both
sides: reference source truncated at a newline boundary when oversized (it's
raw material for a rewrite, not the product) and the output cap sized to the
remaining budget (conservative 3 chars/token estimate, 7600-token budget,
2800-token output floor).

### 3. Explainer + route + tests

`services/ai_explain.py` imports from `services.groq` (schema, prompts,
validation all unchanged — the seam held). `routes/ai.py` catches Groq's
`AIUnavailable` for `/ai/explain`. Tests: only the 503 test changed
(`GROQ_API_KEY` instead of `GEMINI_API_KEY`); the mocked success path passed
untouched because it mocks at the feature-service seam. Suite: 51 passed.

Live-verified: explainer returns grounded structured JSON on a 4-node
bottleneck graph; ingest day 8 produced a 9.5k-char lesson with a mermaid
diagram, published. Remaining 52 roadmap days batch-ingested via
`python -m services.roadmap_ingest --days ... --publish` (self-paces under
the per-minute cap via retry-after).

### Open items

- [ ] Rate limiting on `/ai/*` before public deploy (now burns Groq quota:
      per-minute AND per-day caps)
- [ ] Frontend mentor UI still pending an Anthropic key

---

## 2026-07-27 — Roadmap ingest finished: 76/76 lessons live

Closes out the ingest that's been running since 2026-07-16 (Gemini → Groq
migration above). This entry is less about new code and more about the
**operational shape of a long-running AI batch job** — the interview story
is in how it survived interruptions, not the happy path.

### 1. The daily-quota wall — and why we didn't try to out-wait it

Groq's free tier caps `qwen/qwen3.6-27b` at **200,000 tokens/day**, separate
from the per-minute cap `groq._post` already retries. The overnight batch
hit it mid-run: `Rate limit reached ... on tokens per day (TPD): Limit
200000, Used 198158 ... try again in 32m19s`. Deliberately did **not**
stretch `_post`'s retry loop to cover this — the per-minute retry is capped
at 120s for a reason (a hung process waiting 30-40 minutes on a single HTTP
call is its own operational hazard, and the wait time shrinks unpredictably
run to run as `Used` drifts). Instead: let those days fail through the
pipeline's existing per-day try/except (`ingest_days` was already built to
survive one bad day without aborting the batch — 2026-07-16 decision), then
just re-run the reported failed days once the daily counter rolled over.
**The idempotent `day`-unique upsert (`upsert()` in `roadmap_ingest.py`) is
what makes this safe** — re-running a batch that includes already-done days
is a no-op for those days, so there's no bookkeeping needed about exactly
where a batch stopped.

### 2. Session interruption — verify state, don't trust the transcript

The batch was also running as a background shell when the *Claude Code
session itself* ended mid-run. On resume, the task notification for that
background process said "stopped... may have been running when the
previous process exited" — an ambiguous signal, not a completion record.
Rather than guess, the right move was to re-query the actual source of
truth: `SELECT day FROM roadmap_lessons` diffed against the curriculum's
76 expected days, which is cheap and unambiguous. This is the same
principle as the day-level idempotency above, generalized: **when a batch
job's own state (a DB row per unit of work) is more trustworthy than the
process supervisor's status string, check the state, not the process.**

### 3. Trust but verify: JSON mode isn't a schema guarantee

Two days failed on retry for reasons unrelated to quota, both handled by
the existing per-day resilience without new code:

- **Day 67:** Groq itself returned `HTTP 400 json_validate_failed` — its
  own JSON-object-mode generation produced invalid JSON server-side. This
  is a correction to the 2026-07-26 entry's framing: Groq's `json_object`
  mode makes invalid JSON *rare*, not impossible. The real safety net was
  never the mode guarantee — it's `ingest_days` treating every day as
  independently retryable.
- **Day 74:** a bare `RemoteDisconnected` — ordinary transient network
  failure, no special handling needed.

Both succeeded on a plain retry (`--days 67,74`).

### 4. Content-validation gap: the prompt rule isn't self-enforcing

Two published lessons (days 40, 76) contained ASCII box-drawing diagrams
despite the ingest system prompt's explicit "never ASCII, always Mermaid"
rule (2026-07-16 decision). **The pipeline validates JSON *shape*
(`_SCHEMA`) but has no check on markdown *style* inside `body_md`** — a
model can satisfy the schema and still violate a prose-level house rule.
Caught by a manual sweep (`set('│├└┌┐▶▼┼┘') & set(body_md)`) across all 76
lessons post-ingest, not by the pipeline itself — this is the gap to close
if ingest runs unattended again (e.g. reject/retry on a matched glyph set).

Fixed via `scripts/convert_ascii_to_mermaid.py` (already existed for this
exact class of problem from 2026-07-16's pre-prompt-fix lessons — idempotent,
skips lessons with no ASCII fence, so reruns are free):

- **Day 40** (module folder tree) → a `flowchart TD` reproduces the
  parent/child structure Mermaid is made for.
- **Day 76** (Snowflake ID 64-bit field layout) → a **markdown table**, not
  Mermaid. No Mermaid diagram type represents a bit map; forcing one would
  be worse than the ASCII it replaces. Worth saying explicitly in an
  interview: the fix for "never do X" isn't always "always do Y instead" —
  sometimes it's "do Y, except when the content doesn't fit Y's shape."

### Final numbers

76/76 lessons ingested and published. Avg body 6,412 chars, 65/76 contain a
Mermaid diagram (the rest are diagram-free by content, not by gap), zero
remaining ASCII-art, zero reasoning-model `<think>` leakage. Full backend
suite still 51 passed (this work touched no application code, only the
one-off conversion script).

### Open items

- [ ] Ingest pipeline has no automated style-conformance check (ASCII glyphs,
      stray markdown fences) — currently a manual post-ingest sweep; worth a
      cheap regex gate in `transform()` if ingest runs again unattended
- [ ] Rate limiting on `/ai/*` before public deploy (carried over)
- [ ] Frontend mentor UI still pending an Anthropic key (carried over)

## 2026-07-28 — Retrofitted Alembic: `alembic/versions/` was empty

`db/session.py` and `main.py` already documented the intent ("Alembic
migrations apply [to Postgres]... create_all is a no-op on tables that
already exist") but nobody had ever generated a migration — the local
SQLite dev DB (`systemsim.db`, 76 published roadmap lessons + empty
`users`/`designs`) existed purely from `Base.metadata.create_all` at
startup. Schema changes since day one had no version history, which is
fine solo but breaks the moment a second environment (Postgres, a
teammate, CI) needs the same schema.

**Fix — no Docker available in this environment, so autogenerate ran
against a throwaway empty SQLite file instead of the intended Postgres
target.** This works because Alembic's autogenerate diffs the live DB
against `Base.metadata`, not against a specific dialect — pointing it at
an empty DB just makes the diff "everything is new," which is exactly the
initial migration. Steps:

1. `mkdir alembic/versions` (never existed)
2. `DATABASE_URL=sqlite:////tmp/... alembic revision --autogenerate -m "initial schema"`
   against an empty file → `4a6f17d95c7b_initial_schema.py`, all 4 tables
   + indexes + FKs, matching the SQLAlchemy models exactly
3. Verified it applies cleanly: `alembic upgrade head` against a second
   fresh empty SQLite file → all 4 tables created correctly
4. **Stamped, not upgraded, the real dev DB**: `DATABASE_URL=sqlite:///./systemsim.db
   alembic stamp head`. This records "you're at head" in a new
   `alembic_version` table without touching existing rows — the tables
   already existed via `create_all`, so running `upgrade` would have
   tried (and failed) to `CREATE TABLE` things that were already there.
   Confirmed after: still 76 rows in `roadmap_lessons`, untouched.

**Talking point:** the standard move for retrofitting migrations onto a
DB that predates them is autogenerate-from-empty (to get the migration
file) + `stamp` (to align an already-correct live DB with it), never
`upgrade` on a DB that already has the schema. `create_all` stays in
`main.py` for the zero-infra SQLite path (harmless no-op once tables
exist); Alembic is now the actual source of truth for schema evolution
against Postgres.

Still open, deliberately not done here: this environment has no Docker,
so the migration was never dry-run against real Postgres — only SQLite.
Postgres and SQLite diverge on some types (JSON, timezone-aware
DateTime); worth an `alembic upgrade head` against the docker-compose
Postgres before this is trusted for a real deploy.

## 2026-07-28 — RAG: the mentor now retrieves and cites platform content

Full architecture + tradeoffs: `docs/RAG.md` (written interview-first;
read that before this entry). This entry logs what was BUILT and the two
operational lessons from the day.

New pieces: `models/rag_chunk.py` (+ migration `fccb348abe62`),
`services/embeddings.py` (Gemini `gemini-embedding-001`, 768-dim, task-type
aware, retryDelay-honoring backoff), `services/rag.py` (heading-aware
chunker + exact numpy cosine over an in-process cached matrix),
`services/rag_index.py` (idempotent content-hash-diffed build CLI),
`services/mentor.py` (orchestration: retrieve → prompt → Claude→Groq chain
→ server-assembled citations). `routes/ai.py` mentor response is now
`{answer, grounded, provider, sources[]}`. Frontend renders "Grounded in"
citation chips that deep-link via chunk anchors. Tests: 9 new (chunker
boundaries/overlap/fence-safety, ranking, per-source cap, exclude-current,
empty-index short-circuit, mentor contract + degradation) — suite at 60.

Lesson 1 — **read the provider's retry hint instead of guessing.** The
first index build died on Gemini 429s: blind exponential backoff (3s/6s/
12s) burned all retries inside one per-minute quota window. Gemini 429
bodies carry `RetryInfo.retryDelay` ("39s") — honoring it plus 2s batch
pacing made the same build complete. Same family of lesson as the Groq
`retry-after` handling (2026-07-26), different provider spelling.

Lesson 2 — **`--reload` dev servers race your migrations.** The running
uvicorn re-imported main.py the moment the model file landed and
`create_all`'d `rag_chunks` before `alembic upgrade` ran — so upgrade
failed on "table already exists" and the right move was `alembic stamp`,
not a retry. Rule of thumb recorded: with a reloading dev server up,
adding a model means the table may already exist by the time you migrate;
stamp is the reconciliation tool (second time today it earned its keep).

Deliberately NOT built (judgment, logged for interviews): no vector DB
(~550 chunks = 1.7 MB matrix, exact search < 1 ms — pgvector documented as
the ~50k-chunk upgrade behind the `rag.retrieve()` seam), no retrieval
eval set yet (named as the honest gap in docs/RAG.md — threshold tweaks
are currently judgment, not measurement), no rate limiting (still the
top pre-deploy TODO, now covering one more expensive endpoint).

## 2026-07-29 — Two RAG bugs fixed, general fallback, floating global chat

Full architecture + every tradeoff: `docs/RAG.md` §3.5, §4 (updated same
day). This entry is the build log: what changed, in what order, and the
two more operational lessons the day produced.

### 1. Two bugs, found by live-testing the mentor before building on it

Before adding surface area, tried to break what shipped 2026-07-28.

- **Citations decorating answers that never used them.** Asked the mentor
  "what's your favorite pizza topping?" It correctly redirected — but
  `sources` still came back with 4 chips at ~0.52 cosine (barely over the
  0.45 floor: noise-level similarity for generic English against any
  corpus). The model ignored all four; the API returned them anyway because
  `sources` reflected *what retrieval found*, not *what the answer used*.
  Fix: `mentor._cited_sources()` now regexes the generated text for `[S#]`
  and keeps only chunks actually referenced; `grounded` derives from that,
  not from `bool(chunks)`. Deliberately not a threshold fix — "did the model
  use it" is a better question than any score cutoff, because it doesn't
  require guessing right about relevance in advance.
- **Boilerplate outranking real content.** A citation chip read "Day 54 ›
  Try it in the sandbox" — checked the DB, that section is the generic
  "build this yourself" CTA every lesson ends with (per the ingest prompt).
  Fixed at the source: `chunk_markdown()` skips any section whose heading
  starts with that phrase. Rebuilding the index (`rag_index.py build`)
  dropped 547 → 499 chunks with **zero embedding calls** — pure deletions,
  exactly the case the diff-based build (2026-07-28) was designed for.

Both fixes are logged in `tests/test_rag.py` as regression tests, not just
prose — `test_mentor_drops_retrieved_but_uncited_sources` and
`test_chunker_excludes_the_sandbox_cta_boilerplate`.

### 2. Prompt rework: platform-first, general knowledge as a labeled fallback

Satyam's ask: let the assistant answer general questions, but strictly only
when the platform corpus has nothing relevant — "mostly use the embeddings."
Rewrote `mentor._SYSTEM` with an explicit PRIORITY ORDER (context → platform
passages → general knowledge, last, clearly labeled). This is a deliberate,
narrow carve-out from CLAUDE.md's "no open-ended chat" rule, called out as
such in both CLAUDE.md and RAG.md — retrieval still runs on every question;
the fallback only fires when steps 1–2 find nothing. Verified live: "explain
CAP theorem in general" on the Discord mentor produced *"Outside SystemSim's
own content, but generally speaking..."* instead of the old bare redirect.

### 3. The floating global assistant — one core, three context modes, auth-gated

`mentor.answer()` (case-study-only) generalized into `mentor.respond()`,
taking `case_study` xor `sandbox` xor neither. New `services/chat.py` layers
persistence and rate limiting on top for the new surface
(`POST /ai/chat`, `GET /ai/chat/history`, both `get_current_user`-gated) —
`/ai/mentor`'s contract and tests were untouched by the refactor.

`FloatingChat.jsx` mounts once in `App.jsx` (survives route changes) and
infers context from `useLocation()` + the Zustand stores: case-study slug on
`/case-studies/:slug`, `serializeGraph()` + `simResult` on `/sandbox`,
general elsewhere. Auth-gated on purpose — not cosmetic: `services/chat.py`
rate-limits by `SELECT COUNT(*)` over `ai_messages` per `user_id` (20
msgs/10 min), and that only works because every message has an owner. No
Redis; a plain indexed query is faster than the LLM call it's protecting at
this scale, same "no vector DB" reasoning as 2026-07-28.

New table `ai_messages` (migration `255eb0fe9155`) — auth-gated by design so
persisted history and the rate limit both have a `user_id` to attach to.

### 4. Two more operational lessons

- **SQLite silently drops tzinfo on read even from `DateTime(timezone=True)`
  columns.** `_check_rate_limit()`'s retry-after math crashed
  (`can't subtract offset-naive and offset-aware datetimes`) — the write was
  correct (UTC), the read back came naive. Postgres round-trips this
  correctly; SQLite doesn't. Normalized with `.replace(tzinfo=timezone.utc)`
  before subtracting. Worth remembering anywhere else this schema's
  timestamps get arithmetic done on them, given SQLite-dev/Postgres-prod is
  this project's whole persistence story.
- **A `--reload` dev server plus a splash screen combine into flaky manual
  QA, not a product bug.** Chasing down what looked like a broken
  entrance/exit animation on `FloatingChat` (frozen at partial opacity) led
  to a real, if minor, pre-existing issue: `SplashLoader`'s full-screen
  overlay animates opacity but never sets `pointer-events: none`, so it
  keeps swallowing clicks on the real UI underneath for its ~450ms fade-out
  — every navigation in this session's testing landed inside that window.
  One-line fix (`frontend/.../SplashLoader.jsx`): the overlay has no
  interactive elements of its own, so it never needed to capture pointer
  events at all. Unrelated to RAG, found only because live UI testing
  surfaces things unit tests structurally cannot.

### Final state

70/70 backend tests passing (was 60 at the top of this session — 9 from
2026-07-28's RAG work, 1 renamed, 10 new: chunker boilerplate exclusion,
citation-filtering, and the full `/ai/chat` surface). Frontend: `FloatingChat`
verified live in all three context modes (case study, sandbox, general),
history reload-and-refetch verified across a hard page reload.

### Open items

- [ ] Retrieval evaluation set (carried over) — the honest gap; threshold
      and chunking changes are still judgment, not measurement
- [ ] `/ai/explain` still has no rate limit — no auth requirement to hang
      one on yet; `/ai/mentor` and `/ai/chat` are now covered
- [ ] Migrations still untested against real Postgres (carried over, no
      Docker in this environment)
- [ ] Frontend mentor UI still pending a real `ANTHROPIC_API_KEY` to
      prefer Claude in practice (currently every live answer is Groq)

## 2026-07-29 — 7 hand-authored diagrams depended on static assets that were
## never committed; converted to Mermaid, same fix as the ASCII diagrams

Pre-deploy audit found 7 roadmap lessons (days 4, 13, 22, 28, 45, 64, 72)
referencing `![]()` image markdown pointing at
`/static/roadmap/diagrams/*.svg` — 5 attached by `scripts/attach_diagrams.py`,
2 hardcoded in `scripts/seed_roadmap.py`. Those SVGs were hand-authored
locally at some point but `backend/static/roadmap/` is gitignored ("ingest
build artifacts") and the files don't exist anywhere on disk, in git history,
or anywhere searchable on this machine — the environment that originally
authored/attached them is gone. Same failure mode already hit and fixed once
for the 2 ASCII-diagram lessons (`convert_ascii_to_mermaid.py`); this is the
same fix applied to the remaining 7.

Fix: both source scripts now emit Mermaid fenced blocks directly into
`body_md` instead of image references — Mermaid is already the platform's
diagram mechanism (CLAUDE.md: "Diagrams are our own assets... Flowcharts
render via Mermaid... never ASCII"), travels as text in the DB row, and
renders client-side (`Mermaid.jsx`), so there's no static-file dependency at
all going forward. Added `scripts/replace_diagram_images_with_mermaid.py` to
patch any lesson rows that already have the old image markdown baked in
(regex swap, idempotent) — needed because the two script edits only change
what future runs produce, not rows already ingested wherever the real
76-lesson data lives (this checkout's local SQLite has 0 roadmap rows, so
the migration script has to be run against wherever that actually is —
Neon/Postgres — before or during deploy).

Not independently render-verified against the actual `mermaid` npm package
(no jsdom in this environment, and adding it just for a one-off check wasn't
worth a new dependency) — verified by manual syntax review against the same
shape conventions (`([...])` stadium, `[(...)]` cylinder, `{...}` decision,
`[[...]]` subroutine) already proven to render in this codebase via
`convert_ascii_to_mermaid.py`. Worth a live spot-check in the frontend once
lessons are seeded into a real DB.

---

## 2026-07-29 — Dev DB moved off local SQLite onto hosted Neon Postgres

Directly caused by the empty-database incident above (also independently
hit by another session, per its own note that "this checkout's local
SQLite has 0 roadmap rows"): local dev's SQLite file went from 76 published
roadmap lessons to zero rows in every table, with the cause never
confirmed. Full incident writeup, timeline, and the "what did and didn't
cause it" reasoning: `docs/INCIDENTS.md` #1 — logged there instead of here
because it's a *pitfall*, not a *build*, and deserves its own scannable file
going forward (also new this session, see below).

### 1. Neon setup — branch-per-dev, not a shared DB

DECISION (Satyam): Neon project `SystemSim`, `production` as the default
branch, a `dev` branch (child of `production`) for local work. WHY
branch-per-dev over one shared connection string: local testing (a bad
script, a wipe-and-reseed) can't touch whatever `production` ends up
holding once this deploys, and Neon branches are cheap/instant to create
from a parent's data + schema if a reset is ever wanted. Caught one gotcha
before it repeated the exact incident above: **Neon free-tier child
branches auto-delete after 24 hours by default** — the `dev` branch's own
overview page said so before any schema work started. Disabled via "Edit
Expiration" — see `docs/INCIDENTS.md` #4.

### 2. Migration order matters on a brand-new database

Ran `alembic upgrade head` against the fresh Neon `dev` branch *before*
anything else touched it (before ever running `uvicorn main:app` against
it). This matters because `main.py`'s `Base.metadata.create_all` runs on
every app startup and would otherwise create all tables directly — which
works, but never stamps `alembic_version`, so the very next
`alembic upgrade` fails trying to re-create tables that already exist
(same failure mode as `docs/INCIDENTS.md` #6, already hit once before on
this project). Alembic doesn't read `.env` on its own — `alembic/env.py`
does `os.environ["DATABASE_URL"]` directly — so this needs the var exported
into the shell first (`export DATABASE_URL=$(grep ... .env)`) when running
`alembic` by hand outside the app.

All three existing migrations (initial schema, `rag_chunks`, `ai_messages`)
applied cleanly against real Postgres on the first try — the earlier
worry logged in `docs/RAG.md`/BACKEND_LOG 2026-07-28 ("migrations still
untested against real Postgres, no Docker in this environment") is now
resolved; `psycopg2-binary` was already in `requirements.txt` and the
`sa.JSON()` columns map fine to Postgres's native JSON type.

### 3. Recovering content without re-spending AI quota twice

A `roadmap_ingest` batch happened to already be running against the local
SQLite file when the Neon decision landed (re-filling the 76 lessons after
the empty-DB incident). Rather than restart it against Neon from zero and
burn Groq quota twice for identical content, wrote
`scripts/copy_roadmap_to_neon.py` — copies `roadmap_lessons` rows from the
local SQLite file into Neon, upserting by `day` (idempotent, matches the
ingest pipeline's own pattern), so it's safe to re-run as more days finish
locally. **First run silently did nothing to Neon** — the script forgot
`load_dotenv()` before importing `db.session`, so `DATABASE_URL` wasn't in
the process environment and it silently fell back to SQLite, re-copying 11
rows into the same file they came from. No error, no crash — just the
wrong target. Fixed by adding the same `load_dotenv()` call
`services/roadmap_ingest.py` already has, for exactly this reason. Full
gotcha writeup: `docs/INCIDENTS.md` #3.

Once `.env`'s `DATABASE_URL` pointed at Neon, no more copying was needed —
`services.roadmap_ingest` writes directly there like any other DB-touching
script. The original SQLite background batch had also died silently by
this point (no process, no final log line — see `docs/INCIDENTS.md` #2 for
the `nohup ... & disown` fix that made the resumed batch survive), so the
remaining ~65 days were re-launched directly against Neon rather than
resumed against SQLite.

### 4. New file: `docs/INCIDENTS.md`

Also added this session: a dedicated, append-only "what broke and what to
know" file, separate from this design-log. WHY separate: this log is
organized by *feature built*, which makes "have I hit this exact gotcha
before?" a full-file search; `docs/INCIDENTS.md` is organized by *pitfall*,
with a one-line quick-reference table at the top. Cross-references both
ways rather than duplicating — this entry points there for incident detail,
it points back here for the small number of gotchas already fully written
up elsewhere (the Alembic stamp/upgrade race, SQLite's tzinfo drop).

### Open items

- [ ] Roadmap ingest against Neon was still running as of this writing
      (~34/76 done, climbing) — same daily Groq quota wall as 2026-07-27 is
      possible; resuming is a no-op either way (idempotent per-`day` upsert)
- [ ] `scripts/attach_diagrams.py` (5 hand-authored Mermaid diagrams) hasn't
      been re-run against the fresh Neon rows yet — needed once ingest
      finishes, for days 13/28/45/64/72
- [ ] `rag_chunks` needs a full rebuild against Neon once roadmap ingest
      finishes (`python -m services.rag_index build`) — currently empty
      there, so the mentor/chat have nothing to retrieve
- [ ] `users`/`designs`/`challenge_attempts` are empty on Neon (nothing to
      recover — real account data with no other source of truth)
- [ ] Google OAuth as an additional (not replacement) sign-in option — real
      decision made this session, deferred pending its own Google Cloud
      OAuth app setup; see CLAUDE.md
- [ ] Fly.io deploy itself deliberately not started this session (database
      work only, per explicit instruction) — `fly.toml`/`Dockerfile` exist
      and are ready whenever that's next
- [ ] Rate limiting on `/ai/*` before public deploy (carried over, several
      entries running)
- [ ] **Days 41-53 (13 lessons) were generated by Groq/llama-3.3-70b while
      both Gemini and qwen were simultaneously exhausted, before the
      provider chain was reordered to prefer qwen.** Measurably thinner
      than qwen/Gemini output (~2-4k chars vs ~5.3-5.9k, fewer takeaways,
      Mermaid only ~50% of the time vs ~85%) — published and functional,
      not broken, just below the quality bar the rest of the roadmap hits.
      Regenerate with `python -m services.roadmap_ingest --days 41-53
      --publish` once qwen/Gemini have headroom (upsert is idempotent by
      `day`, so this is a plain overwrite, no cleanup needed first).

## 2026-07-30 — Anthropic dropped entirely; Cloud Run + Cloudflare Pages deploy setup

Two things this session, both driven by "actually deploying now."

### 1. Anthropic dropped — Groq covers every generation task

Satyam's call: the Anthropic key was never real in prod (placeholder,
503'd), and rather than keep provisioning/maintaining a fallback chain to a
provider never actually used live, all AI generation now runs on Groq.
Gemini stays embeddings-only (`services/embeddings.py` — Groq has no
embeddings endpoint).

`services/mentor.py`'s `_generate` — previously a Claude-preferred,
Groq-fallback chain (2026-07-28 decision, itself already a defensive
measure against the placeholder key) — is now Groq-only, with a new
`GROQ_MENTOR_MODEL` env var (`services/groq.py`, defaults to `GROQ_MODEL`
so it works unconfigured) tried first, `GROQ_MODEL` as the fallback. Kept
the two-attempt shape deliberately: the old chain's value wasn't really
"Claude vs Groq," it was "one bad/rate-limited generation call shouldn't
503 the whole assistant" — that property is worth keeping even with a
single provider, just expressed as two model attempts instead of two
vendors.

`services/claude.py` deleted outright (no importers left after the
`mentor.py` change — confirmed via a repo-wide grep before deleting, not
just diffing this one file). `ANTHROPIC_API_KEY`/`CLAUDE_MODEL` removed
from `.env.example`, the Cloud Run deploy workflow's Secret Manager list,
and `docs/DEPLOYMENT.md`'s provisioning steps. Test suite updated
(`conftest.py`, `test_api.py`, `test_chat.py`, `test_rag.py` — mocked
`"claude"` provider strings and the module-level `ANTHROPIC_API_KEY` pop
were the only touch points); all 70 tests still pass.

**Tradeoff accepted, stated plainly:** the old chain's real resilience
property — a different vendor to fall back to if one has an outage — is
gone. A Groq-wide outage now 503s `/ai/mentor` and `/ai/chat` outright
where it previously would have fallen through to Claude. Acceptable here
because Claude was never the one actually serving traffic anyway; worth
revisiting only if Groq's reliability in practice turns out worse than
expected.

### 2. Cloud Run (backend) + Cloudflare Pages (frontend) deploy, walked live

Full checklist in `docs/DEPLOYMENT.md`, GCP project `systemsim-504004`
created and provisioned this session (Artifact Registry, `systemsim-deployer`
service account + IAM, Secret Manager secrets + runtime SA grant). One
incident worth recording for future sessions: a service-account JSON key
was pasted into a chat transcript mid-setup — treated as compromised on
sight, revoked (`gcloud iam service-accounts keys delete`), and reissued
with instructions to paste the replacement directly into GitHub's secret
UI rather than back through chat. No downstream exposure (caught before
the key was ever used), but worth the reminder: a credential that touches
a chat transcript is compromised the moment it's pasted, regardless of
whether anything reads the transcript afterward — rotate, don't just
"be more careful next time."

`frontend/vercel.json` (added earlier this session for an initial
Vercel-targeted plan) replaced with `frontend/public/_redirects` once
Satyam confirmed Cloudflare Pages, not Vercel — same SPA-fallback need
(the app uses `createBrowserRouter`), different host's mechanism.

## 2026-07-30 (cont.) — Backend deploy actually succeeded; live status tracker added

Continuation of the same-day session above — the GCP setup got walked live
through to a working deploy, not just provisioned.

**Two real gaps hit provisioning the GCP side, beyond what the checklist
anticipated:**

1. `roles/artifactregistry.writer` didn't land on `systemsim-deployer`
   despite being in the same `for role in ...; do gcloud projects
   add-iam-policy-binding ...; done` loop as two roles that did land. Cause
   unconfirmed (loop output wasn't checked per-iteration at the time) —
   caused `docker push` to fail with `permission denied` on
   `artifactregistry.repositories.uploadArtifacts`. Fixed by granting the
   role again directly. Lesson for next time: verify all granted roles show
   up in `gcloud projects get-iam-policy`, don't trust a loop ran clean from
   its aggregate exit code alone.
2. `pg_dump` (Cloud Shell's client, Postgres 16) refused to dump from Neon's
   server (Postgres 18) — refuses by design on a newer major version.
   Switched to `psql -c "\copy ... WITH CSV HEADER"` for the one-time
   `dev` → `production` roadmap content backlog copy (62 lessons,
   `rag_chunks` still empty on both — RAG index never built against Neon).
   Both operations need the DIRECT (unpooled) connection string, not the
   `-pooler` one the app uses.

**Deploy confirmed live:** `https://systemsim-api-kicddhkfiq-uc.a.run.app`
— `/health`, `/casestudies`, `/roadmap` (62 published lessons) all verified
against the `production` Neon branch.

**Content-publishing workflow decided:** rather than keep manually copying
`dev` → `production` after every ingest batch, future ingestion should
target `production`'s `DATABASE_URL` directly. The schema already has the
right primitive for this — `RoadmapLesson.published` (bool, defaults false,
every public route in `services/roadmap.py` filters on it) — so new lessons
land as invisible drafts and go live the instant `--publish` runs, no
staging database, no redeploy. This wasn't obvious until re-examining the
schema mid-session; the original dev/production DB split was designed for
app-code testing (not touching real user accounts), and got reflexively
applied to content authorship too, where it doesn't actually fit.

**New file: `docs/DEPLOYMENT_STATUS.md`** — a living (not append-only)
snapshot of exactly what's deployed, every GCP resource name/role, what's
still pending (frontend, `CORS_ORIGINS` placeholder, RAG index build), and
the incidents above — written specifically so a new Claude Code session
with no conversation memory can resume this work without re-deriving state
from git history. `CLAUDE.md`'s hosting decision now points to it.
