// The Learn layer: theory for each component, written to be read in 90 seconds
// right where it's applied. Shape per entry:
//   what        — the mental model (2-3 sentences)
//   how         — how it behaves under load, i.e. what the simulator models
//   whenToUse   — bullets: reach for this when…
//   realWorld   — named examples engineers will recognize
//   interview   — how to talk about it in a system design interview
//   pitfalls    — the classic mistakes

export const CONCEPTS = {
  client: {
    what: "The traffic source — browsers, mobile apps, IoT devices, or other services calling your system. Every design starts by asking what the clients do: how many, how often, reads or writes.",
    how: "In the simulator the Client emits your configured load (RPS) into the graph. The read/write mix you set describes what that traffic is doing.",
    whenToUse: [
      "Every design needs at least one — it defines the workload.",
      "Model different client types (web vs. mobile vs. API partners) as separate clients when their traffic differs.",
    ],
    realWorld: "Twitter's design starts from '500M tweets/day, 100× more reads than writes'. That single ratio drives the whole architecture.",
    interview: "Always open by estimating client traffic: DAU → requests/user/day → average RPS, then ×3-5 for peak. Interviewers want the back-of-envelope before any boxes get drawn.",
    pitfalls: [
      "Designing for average load — systems die at peak, not average.",
      "Forgetting that clients retry: a slow backend turns 1× load into 3× load.",
    ],
  },
  dns: {
    what: "The internet's phone book: turns a name (api.example.com) into an IP address. It's the first hop of every request from a new client.",
    how: "Modeled as pure passthrough with fixed latency — DNS rarely limits throughput because answers are cached at every layer (device, OS, ISP).",
    whenToUse: [
      "Geo-routing users to the nearest region (latency-based DNS).",
      "Failover: point the name at a healthy region when one dies.",
    ],
    realWorld: "Route 53 and Cloudflare DNS do latency-based and health-checked routing. The 2016 Dyn DDoS took down Twitter, Spotify, and GitHub — by taking out DNS alone.",
    interview: "Mention DNS for multi-region routing and failover, then move on — it's a supporting actor. Bonus points for knowing TTL tradeoffs: low TTL = fast failover but more lookups.",
    pitfalls: [
      "Long TTLs make failover slow — clients keep hitting the dead IP.",
      "Treating DNS as a load balancer: it can't see server health per-request.",
    ],
  },
  cdn: {
    what: "A globally distributed cache that serves content from servers physically near the user. The fastest request is the one that never reaches your origin.",
    how: "Absorbs its hit-rate share of requests at the edge; only misses travel on to your origin. High hit rates turn a 100k RPS problem into a 10k RPS one.",
    whenToUse: [
      "Static assets: images, video, JS/CSS bundles.",
      "Cacheable API responses (public, read-heavy, tolerate slight staleness).",
      "Absorbing read spikes during launches and viral moments.",
    ],
    realWorld: "Netflix built Open Connect — its own CDN inside ISPs — because video is ~95% of its bytes. Cloudflare and Akamai front much of the public web.",
    interview: "Quote the hit-rate math: at 90% hit rate, origin traffic drops 10×. Then note the tradeoff: cache invalidation and staleness windows.",
    pitfalls: [
      "Caching personalized or authenticated responses (data leaks).",
      "Ignoring invalidation — stale content after a deploy.",
      "Assuming CDN helps writes. It doesn't; writes still hit origin.",
    ],
  },
  api_gateway: {
    what: "The single front door for your APIs: authentication, routing, rate limiting, and request shaping happen here, so every backend service doesn't reimplement them.",
    how: "Modeled as a rate limiter with routing latency: traffic above the configured limit is rejected at the gate, protecting everything behind it.",
    whenToUse: [
      "Microservices — one entry point instead of exposing every service.",
      "Enforcing auth, quotas, and API versioning in one place.",
      "Shedding abusive or excess traffic before it costs you compute.",
    ],
    realWorld: "Amazon API Gateway, Kong, and Envoy-based gateways (Istio). Stripe and Twilio publish per-key rate limits enforced at their gateways.",
    interview: "Position it as the policy layer: authn/z, rate limiting, routing. Distinguish from a load balancer — the gateway understands the API; the LB understands connections.",
    pitfalls: [
      "Making it a business-logic monolith (the 'god gateway').",
      "A single under-provisioned gateway becoming the bottleneck for everything.",
    ],
  },
  load_balancer: {
    what: "Distributes incoming requests across a pool of servers so no single machine takes the full brunt. The building block that makes horizontal scaling actually work.",
    how: "Splits incoming load evenly across every node connected downstream. Its own capacity is huge but finite — L4 balancers handle enormous rates; the servers behind them are usually the real limit.",
    whenToUse: [
      "Any time you have more than one server (which should be always — N+1).",
      "In front of stateless services to enable rolling deploys and instance failure tolerance.",
    ],
    realWorld: "AWS ELB/ALB, NGINX, HAProxy. Google's Maglev pushes millions of packets/sec per node. Every serious website has one within the first two hops.",
    interview: "Say 'stateless services behind a load balancer' early — it signals you know the standard scaling unit. Know L4 vs L7 (connections vs HTTP-aware) and round-robin vs least-connections.",
    pitfalls: [
      "Sticky sessions that pin users to instances — kills elasticity; externalize session state instead.",
      "Balancing stateful services without consistent hashing (cache stampedes).",
      "Forgetting the LB itself needs redundancy — it's a SPOF too.",
    ],
  },
  rate_limiter: {
    what: "A hard ceiling on request rate. Beyond protecting revenue APIs from abuse, it's how systems fail gracefully: reject some traffic cleanly instead of collapsing under all of it.",
    how: "Requests above the threshold are dropped immediately; everything below passes untouched. Watch achieved throughput cap exactly at the threshold.",
    whenToUse: [
      "Public APIs — per-key quotas (Stripe, GitHub style).",
      "Protecting a fragile downstream (a legacy DB, a third-party API).",
      "Load shedding during incidents: serve 80% well instead of 100% badly.",
    ],
    realWorld: "GitHub's API: 5,000 requests/hour per token. Cloudflare rate-limits at the edge. Netflix's Zuul sheds load by priority when backends degrade.",
    interview: "Name an algorithm — token bucket (allows bursts) or sliding window (smoother) — and where the counters live (Redis for distributed limiting). That detail separates memorizers from engineers.",
    pitfalls: [
      "Rate limiting by IP alone — breaks users behind corporate NATs.",
      "Returning 429 without Retry-After, so clients hammer harder.",
      "Local (per-instance) counters that multiply the real limit by instance count.",
    ],
  },
  app_server: {
    what: "Where your business logic runs — the code you actually wrote. Stateless by design, so any instance can serve any request, and capacity is just instances × per-instance throughput.",
    how: "Capacity = instances × RPS-per-instance. Load beyond that overloads the node: latency climbs, requests queue and drop. Scale out (more instances) or up (faster ones).",
    whenToUse: [
      "The request/response path of every design.",
      "Keep it stateless: session data in Redis, files in object storage — then scaling is trivial.",
    ],
    realWorld: "Kubernetes pods, EC2 auto-scaling groups, Cloud Run. Shopify runs pods of stateless Rails servers; flash sales scale by adding pods, not by touching code.",
    interview: "Estimate per-instance throughput honestly (a typical CRUD service: 200-1000 RPS/instance), derive the fleet size from load, then add N+1 headroom. Showing the arithmetic is the point.",
    pitfalls: [
      "Hidden state (in-memory sessions, local file writes) that breaks horizontal scaling.",
      "Autoscaling on CPU when the bottleneck is DB connections or I/O wait.",
      "No connection pooling — 500 app instances × 100 connections melts the database.",
    ],
  },
  worker: {
    what: "A consumer that processes jobs from a queue in the background, off the request path. Users get a fast acknowledgment; the heavy work happens asynchronously.",
    how: "Drains the queue at instances × consume-rate. If producers outpace the drain, the queue lags — that lag is your early-warning metric.",
    whenToUse: [
      "Anything slower than ~100ms that the user doesn't need to wait for: emails, video transcoding, feed fan-out, report generation.",
      "Smoothing spiky writes into a steady database load.",
    ],
    realWorld: "YouTube transcodes uploads via worker fleets. Instagram fans out posts to follower feeds asynchronously. Sidekiq/Celery/SQS consumers are this exact pattern.",
    interview: "Say 'accept, enqueue, return 202, process async' for slow operations. Mention idempotency immediately — workers retry, so processing the same job twice must be safe.",
    pitfalls: [
      "Non-idempotent jobs + retries = double-charged customers.",
      "No dead-letter queue: one poison message blocks the world.",
      "Forgetting to monitor queue lag — the system 'works' while falling hours behind.",
    ],
  },
  sql_db: {
    what: "The relational workhorse: ACID transactions, joins, strong consistency. The default choice until scale forces tradeoffs — and 'the database is the bottleneck' is the default incident.",
    how: "Writes go only to the primary (its capacity is the write ceiling). Reads spread across replicas. The classic wall: write volume exceeding what one primary can absorb.",
    whenToUse: [
      "Data with relationships and invariants: users, orders, payments, inventory.",
      "When correctness beats raw scale — which is most of the time.",
    ],
    realWorld: "GitHub runs on partitioned MySQL. Stripe on Postgres. Notion sharded Postgres into 480 logical shards when one primary couldn't take the writes.",
    interview: "Scale it in stages and say them in order: (1) read replicas + cache for reads, (2) vertical scaling, (3) sharding for writes — and call sharding a last resort because you lose joins and cross-shard transactions.",
    pitfalls: [
      "Reading your own write from a lagging replica (user saves, refreshes, data 'gone').",
      "Sharding before exhausting replicas + cache — you pay the complexity tax early.",
      "Unindexed hot queries taking down the primary (the real cause of many 'we need NoSQL' moments).",
    ],
  },
  nosql_db: {
    what: "Distributed key-value/document/wide-column stores that partition data across shards by design. You trade joins and (often) strong consistency for horizontal write scale.",
    how: "Capacity = shards × per-shard throughput, reads and writes alike. The simulator warns about join-like access — cross-shard queries are the anti-pattern.",
    whenToUse: [
      "Write volumes beyond one SQL primary: events, messages, timelines, telemetry.",
      "Simple access patterns — fetch by key, append, range scan — at massive scale.",
      "Flexible/heterogeneous records where a fixed schema fights you.",
    ],
    realWorld: "Discord stores trillions of messages in ScyllaDB (after Cassandra before it). DynamoDB backs Amazon's cart. Netflix keeps viewing history in Cassandra.",
    interview: "Justify it with a number: 'writes exceed a single primary (~5-10k sustained RPS), so I partition by user_id'. Then name the tradeoff you accepted: eventual consistency, no joins, and hot-partition risk.",
    pitfalls: [
      "Choosing a partition key that concentrates traffic (the celebrity/hot-key problem).",
      "Using NoSQL for relational data, then reimplementing joins in app code, badly.",
      "Assuming 'NoSQL scales' unconditionally — a bad partition key scales nothing.",
    ],
  },
  object_storage: {
    what: "Infinitely scalable storage for blobs — images, videos, backups, logs — addressed by key, served over HTTP. Not a filesystem, not a database: no partial updates, no queries.",
    how: "Modeled as unlimited capacity with high fixed latency. Throughput is effectively never your bottleneck; latency and cost shape how you use it.",
    whenToUse: [
      "Any file users upload or download.",
      "Data lakes, backups, ML training sets, static site hosting.",
      "As the origin behind a CDN for media.",
    ],
    realWorld: "S3 stores hundreds of trillions of objects at eleven nines of durability. Netflix's video masters, Slack's uploaded files, Snowflake's underlying data — all object storage.",
    interview: "The pattern to recite: metadata in the database, bytes in object storage, delivery via CDN, uploads via presigned URLs so files never pass through your app servers.",
    pitfalls: [
      "Streaming file bytes through app servers instead of presigned direct upload/download.",
      "Storing blobs in the database (bloats it, kills backups, embarrasses you in code review).",
      "Treating it like a disk — 'append to object' is a rewrite of the whole object.",
    ],
  },
  cache: {
    what: "An in-memory copy of hot data (Redis, Memcached) that answers reads in ~1ms so your database doesn't have to. The single highest-leverage component for read-heavy systems.",
    how: "Absorbs hit-rate% of reads; misses fall through to whatever is behind it. The scary scenario is modeled too: when the cache dies, 100% of reads suddenly hit the database — try it.",
    whenToUse: [
      "Read-heavy workloads with skew (some keys much hotter than others) — i.e., almost every consumer product.",
      "Expensive computed results: rendered timelines, aggregations, sessions.",
    ],
    realWorld: "Facebook runs one of the largest Memcached fleets ever to front MySQL. Twitter caches whole rendered timelines in Redis — reads rarely touch storage.",
    interview: "Name the strategy (cache-aside is the default), the eviction policy (LRU + TTL), and the failure modes: stampedes, hot keys, and the thundering herd on cold start. That trio is what interviewers listen for.",
    pitfalls: [
      "Cache stampede: a hot key expires and a thousand requests hit the DB at once (fix: request coalescing, jittered TTLs).",
      "Sizing the DB assuming the cache is always up — a cache flush becomes a full outage.",
      "Caching without an invalidation story (the famous 'two hard problems').",
    ],
  },
  search_index: {
    what: "An inverted index (Elasticsearch, OpenSearch, Algolia) that maps terms → documents, making 'find products matching \"red running shoes\"' fast — a query shape databases are terrible at.",
    how: "Reads are cheap, writes are expensive: every document indexes into many term lists. The simulator enforces a write ceiling — beyond it, indexing lags and results go stale.",
    whenToUse: [
      "Full-text search, autocomplete, faceted filtering.",
      "Log analytics and 'needle in a haystack' queries.",
    ],
    realWorld: "Amazon product search, Uber Eats restaurant search, GitHub code search (custom-built for the same shape). ELK stacks index logs everywhere.",
    interview: "Never make it the source of truth. The pattern: DB is truth, changes flow to the index asynchronously (often via a queue/CDC), search results may lag writes by seconds — say that explicitly.",
    pitfalls: [
      "Writing synchronously to DB and index (slow, and they still diverge on failure).",
      "Using LIKE '%term%' in SQL and calling it search — table scan, doesn't scale.",
      "No reindexing strategy for mapping changes — a multi-day migration surprise.",
    ],
  },
  message_queue: {
    what: "A durable buffer between producers and consumers (Kafka, SQS, RabbitMQ). Producers write and move on; consumers drain at their own pace. It converts 'spike' into 'backlog' — which is a much better problem.",
    how: "Ingests up to its max throughput and hands messages to connected workers. If produce rate exceeds total consumer drain, lag grows — the queue survives, but your data gets stale.",
    whenToUse: [
      "Decoupling: the checkout service shouldn't die because the email service did.",
      "Absorbing bursts: flash sale writes buffer in the queue, DB consumes steadily.",
      "Fan-out: one event, many independent consumers (analytics, notifications, search indexing).",
    ],
    realWorld: "LinkedIn built Kafka and now moves trillions of messages/day. Uber's trip events, Airbnb's booking pipeline, virtually every event-driven architecture.",
    interview: "Introduce it the moment writes are spiky or work is deferrable. Then show depth: delivery semantics (at-least-once ⇒ idempotent consumers), ordering (per-partition only), and lag monitoring.",
    pitfalls: [
      "Assuming exactly-once delivery — design consumers idempotent instead.",
      "Expecting global ordering: Kafka orders within a partition, not across.",
      "Using the queue as a database — unbounded retention hiding a dead consumer.",
    ],
  },
};
