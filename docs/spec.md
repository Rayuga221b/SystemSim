# SystemSim — Locked Spec

The authoritative reference. CLAUDE.md links here. Loaded on demand, not every
session, so detail lives here rather than in CLAUDE.md.

## 14 components (draggable nodes)

Client, API Gateway, Load Balancer, App Server, Worker/Consumer, SQL Database,
NoSQL Database, Object Storage, Cache (Redis), Message Queue, CDN, Search Index,
Rate Limiter, DNS.

Categories: Ingress · Compute · Storage · Async.

## Component behavior contracts (simulation engine)

| Component      | Behavior |
|----------------|----------|
| Client         | source node, emits `load_rps` downstream |
| DNS            | passthrough, adds fixed latency |
| CDN            | absorbs `hit_rate%` of requests, rest passes to origin |
| API Gateway    | applies `rate_limit`, drops excess, passes remainder |
| Load Balancer  | distributes load evenly across N connected app servers |
| App Server     | max capacity = `instances × rps_per_instance` |
| Rate Limiter   | hard cap, drops requests above threshold |
| Cache          | absorbs `hit_rate%` of reads before DB; on failure 100% hits DB |
| SQL Database   | reads split across replicas, writes to primary only; bottleneck = writes > primary capacity |
| NoSQL Database | shards distribute reads/writes; warns if complex join attempted |
| Message Queue  | absorbs spikes, consumers drain at fixed rate; shows lag if produce > consume |
| Worker         | processes queue messages, output goes downstream |
| Object Storage | effectively infinite, fixed latency, no capacity limit |
| Search Index   | read-heavy, warns if write throughput exceeds index limit |

## Simulation engine

- Input: graph JSON (nodes with `capacity_rps`, edges with `latency_ms`) + `load_rps`.
- Traverse from Client via BFS.
- Per node: load > capacity → overloaded (red); > 80% → warning (yellow).
- Cache absorbs `hit_rate%` of reads before DB.
- Message Queue absorbs spikes, shows lag if produce > consume.

### Output schema
```json
{
  "node_statuses": { "<node_id>": "healthy | warning | overloaded | failed" },
  "critical_path_latency_ms": 0,
  "bottlenecks": [],
  "throughput_achieved_rps": 0,
  "throughput_requested_rps": 0,
  "tradeoffs": {
    "consistency": 0, "availability": 0, "scalability": 0, "latency": 0,
    "cost": "low | medium | high", "complexity": "low | medium | high"
  },
  "warnings": []
}
```

## Failure injection modes (toggle on any node)

- `node_crash` → capacity drops to 0
- `slow_node` → latency × 10
- `cache_miss_spike` → hit rate drops to 10%
- `replication_lag` → reads from replica return stale flag
- `queue_backup` → consumer count drops by 50%
- `traffic_spike` → incoming rps doubles

## AI features (Phase 10)

1. **Simulation Explainer** — after each sim, "Explain my design" button.
   Serializes graph + result → prompt. Claude explains WHY nodes bottleneck +
   one concrete fix based on actual diagram state. Streamed, inline in results.
2. **Case Study Mentor** — per case study "Ask about this" button. Sends case
   context + user question. Scoped to that case study only. Preset:
   "Explain this like I'm a junior dev."

## Case studies pipeline

Curated seed URLs in `seed_urls.json` → admin hits `/admin/ingest` → backend
fetches article → Claude API extracts structured JSON (problem, solution,
scale_context, components, lessons) → stored in `case_studies` → manually set
`starter_graph`, then `published = true`.

## Database tables

`users` (id, email, name, avatar_url, created_at)

`designs` (id, user_id→users, title, mode['sandbox'|'challenge'|'casestudy'],
graph_json jsonb, created_at, updated_at)

`case_studies` (id, slug uniq, company, title, source_url, problem, solution,
components text[], scale_context jsonb, lessons text[], starter_graph jsonb,
difficulty['beginner'|'intermediate'|'advanced'], tags text[], published bool,
created_at)

`challenges` (id, slug uniq, title, description, requirements text[],
reference_graph jsonb, difficulty, tags text[])

`challenge_attempts` (id, user_id→users, challenge_id→challenges, graph_json
jsonb, score int, feedback jsonb{missing[],weak[],good[]}, attempted_at)

`simulation_logs` (id, user_id nullable, graph_json jsonb, load_rps int,
result_json jsonb, created_at)
