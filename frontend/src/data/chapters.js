// Core-concept chapters for the Learn page. These teach the METHOD — the
// component-level theory lives in concepts.js and opens via the LearnDrawer.
//
// Shape: { slug, title, minutes, summary, sections: [{ heading, body, takeaway }] }
// body supports paragraphs (blank-line separated), **bold**, and `code`.
// takeaway is one copy-into-your-notes sentence, rendered as a "★ Remember" chip.

export const CHAPTERS = [
  {
    slug: "how-to-approach",
    title: "How to approach any system design",
    minutes: 6,
    summary:
      "A repeatable four-step method that turns a vague prompt into an architecture you can defend — and simulate.",
    sections: [
      {
        heading: "Mine the prompt for requirements",
        body:
          "Every design prompt hides its requirements in plain sight. Read it three times, and hunt for a different part of speech each time:\n\n" +
          "**Verbs become features.** \"Users *post* photos, *follow* friends, *browse* a feed.\" Each action is a feature your system must support — and later, an API endpoint.\n\n" +
          "**Nouns become data.** \"*Photos*, *users*, *comments*.\" Each thing is something you must store. How the things relate to each other tells you what kind of storage fits.\n\n" +
          "**Adjectives become constraints.** \"*Fast* redirects, *always* available, *millions* of users.\" These quality words are the real architects. Two systems with the same features but different constraints look nothing alike.",
        takeaway:
          "Verbs in the prompt are features, nouns are data, and adjectives are the constraints that actually shape the architecture.",
      },
      {
        heading: "Put numbers on it",
        body:
          "\"A lot of traffic\" is not a number. Estimate before you draw anything:\n\n" +
          "Start with daily active users. Multiply by requests per user per day. Divide by ~100,000 seconds (a day, rounded for mental math) to get average requests per second. Then multiply by **3–5× for peak**, because systems die at peak, not at average.\n\n" +
          "Next, find the **read/write ratio** — how many requests read data versus change it. A URL shortener is ~99% reads. A chat app writes constantly. This single ratio decides where your effort goes: caches and replicas help reads, queues and shards help writes.\n\n" +
          "In SystemSim these two numbers are literally the simulation inputs: the load slider and the read/write mix. Getting them right is step zero of every challenge.",
        takeaway:
          "Estimate peak RPS (DAU × requests ÷ ~100k seconds × 3–5) and the read/write ratio before drawing a single box.",
      },
      {
        heading: "Start boring, then scale on evidence",
        body:
          "Draw the simplest thing that could work: `Client → Load Balancer → App Servers → Database`. Almost every real system started here.\n\n" +
          "Now apply pressure, and let **evidence** justify every addition. Add a cache because reads are drowning the database. Add replicas because one machine can't serve the read volume. Add a queue because write spikes arrive faster than storage can absorb them. Every box you add should answer a measured problem — never decorate the diagram.\n\n" +
          "The sandbox gives you exactly this loop: simulate, find the red node, fix that one thing, simulate again. Interviewers call it \"scaling on demand.\" It is also how you avoid building things nobody needs.",
        takeaway:
          "Start with client → load balancer → app servers → database, and only add a component when a measured bottleneck demands it.",
      },
      {
        heading: "Name the tradeoff you just made",
        body:
          "Every fix costs something. Saying that cost out loud is what separates a senior answer from a memorized one.\n\n" +
          "Added a cache? You bought speed and paid in **staleness** — some reads now see old data. Added replicas? You bought read capacity and paid in **replication lag** (copies take a moment to catch up). Sharded the database? You bought write capacity and gave up easy **joins and transactions**.\n\n" +
          "After each simulation, look at the tradeoff profile in the results panel. If consistency dropped when you added that cache, that's not a bug — that's the price tag. Practice the sentence: \"I'm choosing availability over consistency here, because a stale feed is fine and a down feed isn't.\"",
        takeaway:
          "Every fix has a price — caches cost staleness, replicas cost lag, shards cost joins — and saying the price out loud is the senior move.",
      },
    ],
  },
  {
    slug: "reading-a-simulation",
    title: "Reading a simulation like an SRE",
    minutes: 5,
    summary:
      "What every number in the results panel means, and the order a production engineer would read them in.",
    sections: [
      {
        heading: "Start with throughput: did the system do its job?",
        body:
          "**\"X% of traffic served\"** is the headline number. It's the traffic you asked for, minus everything that got *dropped* — rejected by a rate limiter, shed by an overloaded node, or lost to a crashed component.\n\n" +
          "Two details matter. Traffic **absorbed** by a cache or CDN still counts as served — the user got their answer, which is the whole point of a cache. And traffic **buffered** in a lagging queue isn't failed either — it's late, not lost. Only genuine drops hurt the score.",
        takeaway:
          "Served % = requested load minus real drops; cache hits count as served, and queued work is late, not lost.",
      },
      {
        heading: "Then statuses: where is it hurting?",
        body:
          "Every node reports its utilization — the load it received divided by what it can handle:\n\n" +
          "**Healthy** (under 80%) means comfortable headroom. **Warning** (80–100%) means running hot — one traffic spike away from trouble. This is where real-world alerts fire. **Overloaded** (past 100%) means the node is actively dropping everything above its capacity. **Failed** means dead — usually because you crashed it on purpose in chaos mode.\n\n" +
          "The **bottleneck cards** rank the overloaded nodes hottest-first and show the math: `20k rps in · capacity 6k · 333% utilized`. Fix the hottest one first. Relieving the worst bottleneck often un-stresses everything behind it.",
        takeaway:
          "Fix the hottest bottleneck first — nodes go warning at 80% utilization, and relieving the worst one often heals the nodes behind it.",
      },
      {
        heading: "Latency: the critical path",
        body:
          "The latency figure is the **slowest** full route through your graph — deliberately the worst case. Think of a cache *miss* that has to travel all the way to the database. You design for the miss path, because that's the path your angriest user is on.\n\n" +
          "Every hop adds time. That's why long chains matter: `Client → DNS → CDN → Gateway → LB → App → Cache → DB` is eight hops before any real work happens. You only have two levers: fewer hops, or faster tiers.",
        takeaway:
          "Critical-path latency is your worst-case route (the cache-miss path) — shorten the chain or speed up the tiers.",
      },
      {
        heading: "Warnings: the stories the numbers can't tell",
        body:
          "Some problems don't show up in throughput. **Replication lag** means reads may return stale data — the numbers look perfect while users see yesterday's profile picture. **Queue lag** means work is piling up — fine for an hour, an outage by evening. A **disconnected node** means you're paying for a component that serves nothing.\n\n" +
          "Read the warnings last, but always read them. They're the difference between \"the demo worked\" and \"this would survive production.\"",
        takeaway:
          "Perfect throughput can still hide stale reads, growing queues, and dead weight — the warnings panel is where those live.",
      },
    ],
  },
  {
    slug: "tradeoff-profile",
    title: "The tradeoff profile, decoded",
    minutes: 5,
    summary:
      "Why there's no perfect score — and what moves each of the six dials.",
    sections: [
      {
        heading: "There is no 100/100/100/100",
        body:
          "The founding theorem of distributed systems — **CAP** — says that when the network breaks (and it will), you must choose: serve possibly-stale data, or serve nothing. Every real architecture is a negotiated settlement between what you want and what physics allows. The profile makes your settlement visible.\n\n" +
          "So a high score everywhere isn't the goal. A profile that **matches your problem** is. A bank wants consistency even if pages load slower; a social feed wants availability even if a like-count is briefly wrong.",
        takeaway:
          "You can't max every dial — the goal is a profile that matches the problem, like consistency for a bank and availability for a feed.",
      },
      {
        heading: "The four dials",
        body:
          "**Consistency** — will a read see the latest write? Caches, read replicas, and eventually-consistent NoSQL stores each shave points, because each one opens a window where old data can be served. Not a flaw — a price you chose to pay for speed.\n\n" +
          "**Availability** — does one failure take you down? Load balancers, multiple instances, and replicas raise it. Any single point of failure on the traffic path drags it down. Ask of every node: *if this box dies right now, what happens?*\n\n" +
          "**Scalability** — how much headroom is left, and can you buy more by adding machines? Shards, queues, and balanced fleets score well. Running everything at 95% utilization doesn't.\n\n" +
          "**Latency** — scored from your critical path. Fewer hops, faster tiers, and caches near the user all raise it.",
        takeaway:
          "Ask of every node \"what happens if this dies right now?\" — the answer is your availability score.",
      },
      {
        heading: "Cost and complexity: the adult supervision",
        body:
          "The last two chips keep the other four honest. Every instance, replica, and shard costs money. Every distinct technology costs on-call time, hiring, and 3am debugging surface.\n\n" +
          "A 14-component design that serves 1,000 RPS isn't impressive — it's a liability with good intentions. The strongest answer, in an interview and in production, is the *simplest* architecture whose profile matches the requirements. If you can delete a component and the simulation still passes, delete it.",
        takeaway:
          "If you can delete a component and the simulation still passes, delete it — simplest passing architecture wins.",
      },
    ],
  },
  {
    slug: "scaling-playbook",
    title: "The scaling playbook",
    minutes: 6,
    summary:
      "The standard escalation ladder — what to reach for at each stage of growth, and the failure that forces each step.",
    sections: [
      {
        heading: "Stage 1: One box is fine (really)",
        body:
          "`Client → App Server → Database` serves more traffic than most products will ever see. A single well-tuned server handles hundreds of requests per second; a single Postgres, thousands of queries per second.\n\n" +
          "Scaling before you need to is the most expensive mistake in this field. Every stage below should be *forced* on you by a measured bottleneck — never installed \"just in case.\"\n\n" +
          "Try it: build this three-node system in the sandbox and raise the load until it breaks. That number is your first capacity plan.",
        takeaway:
          "One app server and one database go further than you think — scale only when a measured bottleneck forces you to.",
      },
      {
        heading: "Stage 2: Reads are drowning you → cache + replicas",
        body:
          "In read-heavy systems, the first real bottleneck is always the database's read path. Two moves, usually in this order:\n\n" +
          "**Add a cache** (Redis) to absorb the hot keys — the small set of data everyone asks for. At a 90% hit rate, your database sees a tenth of the reads. It's the cheapest capacity you will ever buy.\n\n" +
          "**Add read replicas** — extra copies of the database that share whatever misses the cache. The price is replication lag: a user who writes and then instantly reads may not see their own write yet. (That's the consistency dial dropping.)",
        takeaway:
          "For read-heavy load: cache first (90% hit rate = 10× less DB traffic), then read replicas — and accept the replication lag you just bought.",
      },
      {
        heading: "Stage 3: Compute saturates → balance a fleet",
        body:
          "When app servers hit their ceiling, scale *out*, not up: put a load balancer in front of N identical instances.\n\n" +
          "The key word is **stateless** — no instance keeps anything that matters between requests. Session data lives in Redis, files in object storage. Then any instance can serve any request, and adding capacity is just adding boxes.\n\n" +
          "This stage buys availability for free: with N+1 instances, one can die mid-deploy and nobody notices.",
        takeaway:
          "Stateless app servers behind a load balancer are the standard scaling unit — capacity becomes \"just add boxes,\" and N+1 means one can die unnoticed.",
      },
      {
        heading: "Stage 4: Writes spike past storage → decouple with a queue",
        body:
          "Caches don't help writes — every write still lands on storage. When write bursts arrive faster than the database can absorb them, put a **message queue** between accepting the work and doing it: the API says \"got it\" instantly, and workers drain the queue at a pace the database can sustain.\n\n" +
          "You just converted a *dropped-requests* problem into a *slightly-delayed-work* problem — almost always the better problem to have. But watch the queue-lag warning in the simulator: buffering is a loan, and the workers have to pay it back.",
        takeaway:
          "A queue turns dropped writes into delayed writes — the better problem — but queue lag is a loan your workers must repay.",
      },
      {
        heading: "Stage 5: One primary can't take the writes → shard",
        body:
          "The last resort, because it's the hardest to undo. **Sharding** splits your data across multiple databases by a key — user_id, short-code prefix — so each shard takes a slice of the writes. NoSQL stores do this natively; SQL can, with more ceremony.\n\n" +
          "The costs are real: no more joins or transactions across shards, and a bad key choice concentrates traffic on one **hot shard**. That's the celebrity problem — exactly what melted Instagram (read the case study, then simulate it).\n\n" +
          "Shard when the numbers force you to. Never because the diagram would look cooler.",
        takeaway:
          "Shard only when write volume forces it: you gain write scale, lose cross-shard joins and transactions, and inherit hot-key risk.",
      },
    ],
  },
];

export const CHAPTER_BY_SLUG = Object.fromEntries(CHAPTERS.map((c) => [c.slug, c]));
