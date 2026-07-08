// Interview-prep content for the /interview page, as DATA (same pattern as
// chapters.js). Written from research on how system design interviews are
// actually run and graded (interviewing.io, Hello Interview, System Design
// School, Exponent) — all prose here is original.
//
// Shapes:
//   PHASES[]   — the 45-minute timeline. { id, label, minutes, color, goal,
//                do[], say, redFlag }
//   SIGNALS[]  — what interviewers grade. { id, icon, title, blurb,
//                levels: { mid, senior, staff } }
//   MISTAKES[] — failure modes. { id, title, detail, fix, link?, linkLabel? }
//   DRILLS[]   — interview skill → SystemSim exercise. { id, icon, skill,
//                exercise, to, linkLabel }
//   PLAN[]     — two-week checklist. { id, label, items: [{ id, text, to?,
//                linkLabel? }] }
//   PHRASES[]  — copyable lines, grouped. { group, items[] }

import {
  Calculator, Crosshair, GitBranch, MessageSquare, Scale,
  SearchCode, Timer, Wrench, Siren,
} from "lucide-react";

// ---------------------------------------------------------------- timeline

export const INTERVIEW_MINUTES = 45;

export const PHASES = [
  {
    id: "requirements",
    label: "Requirements",
    minutes: 8,
    color: "#38BDF8", // sky-400
    goal: "Turn a vague prompt into a scoped problem you can actually solve in 37 remaining minutes.",
    do: [
      "Split functional requirements (what it does) from non-functional (how well it must do it).",
      "Pick the top 3 features out loud — and say what you're cutting.",
      "Ask what matters most here: latency, consistency, availability, or cost. The answer shapes everything.",
    ],
    say: "Before I draw anything — I'm scoping this to posting and reading the feed. Search and DMs are out unless you want them in.",
    redFlag: "Drawing boxes in the first two minutes. It reads as “assumes requirements” — the single most common reason candidates fail.",
  },
  {
    id: "estimation",
    label: "Estimation",
    minutes: 5,
    color: "#34D399", // emerald-400
    goal: "Put numbers on the load so your design has something concrete to answer to.",
    do: [
      "DAU × requests per user ÷ ~100k seconds ≈ average RPS. Mental math is fine; precision isn't the point.",
      "Multiply by 3–5× for peak. Systems die at peak, not at average.",
      "State the read/write ratio. That one number decides whether your budget goes to caches or queues.",
    ],
    say: "10M daily users, ~10 reads each — that's roughly 1k RPS average, call it 5k at peak. Reads dominate 100:1, so the read path gets the money.",
    redFlag: "Doing math that never touches the design. Only estimate what changes a decision — otherwise it's theater.",
  },
  {
    id: "high-level",
    label: "High-level design",
    minutes: 15,
    color: "#818CF8", // indigo-400
    goal: "A complete, working end-to-end system on the board. Boring is correct at this stage.",
    do: [
      "Start with client → load balancer → app servers → database. Earn every addition after that.",
      "Walk one request through the whole path, out loud, hop by hop.",
      "Flag the hard parts (“this fan-out will hurt at scale”) without solving them yet — that's what the deep dive is for.",
    ],
    say: "I'll start deliberately simple so we have a working baseline, then scale the pieces the numbers tell us are weak.",
    redFlag: "Layering on shards, three caches, and a message queue before a single request flows end to end.",
  },
  {
    id: "deep-dive",
    label: "Deep dive",
    minutes: 12,
    color: "#FB923C", // orange-400
    goal: "Go genuinely deep on the 1–2 components where the real problem lives. This is where levels get decided.",
    do: [
      "Pick the deep dive yourself if the interviewer doesn't. Choosing well is itself a senior signal.",
      "Let your non-functional requirements point the way — they tell you exactly where to dig.",
      "Cover the failure mode: what does the user see when this component dies, and what's the mitigation?",
    ],
    say: "The interesting problem here is the feed fan-out — can I spend the next ten minutes there?",
    redFlag: "Staying shallow everywhere. Breadth with no depth caps the interview at a mid-level rating.",
  },
  {
    id: "wrap",
    label: "Wrap",
    minutes: 5,
    color: "#A1A1B5",
    goal: "Show you know where your design is weak — before they have to ask.",
    do: [
      "Name your bottlenecks and single points of failure, unprompted.",
      "Say what you'd tackle next with more time.",
      "Recap the two or three tradeoffs you chose and why they fit this problem.",
    ],
    say: "The weakest point is the single-region primary. Given another sprint, that's the first thing I'd fix.",
    redFlag: "Ending with “so… that's my design.” Silence about weaknesses reads as blindness to them.",
  },
];

// ------------------------------------------------------------- evaluation

export const SIGNALS = [
  {
    id: "structure",
    icon: GitBranch,
    title: "Structured navigation",
    blurb:
      "Can you turn a foggy one-line prompt into a plan, and manage your own 45 minutes? Interviewers grade the path as much as the destination.",
    levels: {
      mid: "Follows a clear framework; covers requirements before designing when nudged.",
      senior: "Scopes aggressively, justifies what's cut, and keeps their own clock.",
      staff: "Reframes the problem — finds the real question hiding behind the prompt.",
    },
  },
  {
    id: "decisions",
    icon: Scale,
    title: "Justified decisions",
    blurb:
      "Every box on the board has to earn its place. “Why that component, why there, why now” matters more than the component itself.",
    levels: {
      mid: "Explains what each component does and the problem it solves.",
      senior: "Backs choices with specifics — numbers, configs, past incidents — not brand names.",
      staff: "Weighs team and product cost too: on-call burden, hiring, migration risk.",
    },
  },
  {
    id: "tradeoffs",
    icon: Crosshair,
    title: "Tradeoff fluency",
    blurb:
      "There is no free lunch in distributed systems, and interviewers trust candidates who say the price out loud. Naming a downside is a positive signal, not a confession.",
    levels: {
      mid: "Names the main tradeoff when asked about it.",
      senior: "Surfaces tradeoffs unprompted — and states what would reverse the call.",
      staff: "Frames tradeoffs in business terms: what the product loses, not just the system.",
    },
  },
  {
    id: "drive",
    icon: MessageSquare,
    title: "Driving the room",
    blurb:
      "The interview is a design review, not an exam. Who moves the conversation forward — you or the interviewer — is measured constantly.",
    levels: {
      mid: "Leads requirements and the high-level pass; follows the interviewer into deep dives.",
      senior: "Picks the deep dives, checks in at every transition, adapts to hints fast.",
      staff: "Chairs the whole session like a design review they called — and teaches something.",
    },
  },
];

// --------------------------------------------------------------- mistakes

export const MISTAKES = [
  {
    id: "assume",
    title: "Diving in without requirements",
    detail:
      "Hearing “design a photo app” and building Instagram-in-your-head. The interviewer wanted a medical-imaging archive.",
    fix: "Spend the first 5–8 minutes scoping, then confirm: “does this match what you had in mind?” It feels slow. It's the fastest path.",
  },
  {
    id: "nfr",
    title: "Ignoring the non-functional requirements",
    detail:
      "Listing features and skipping the adjectives — fast, always-on, millions of users. Two systems with the same features and different constraints look nothing alike.",
    fix: "Write the constraints where you can see them. Every deep dive should trace back to one.",
    link: "/learn",
    linkLabel: "Chapter 1 covers mining the prompt",
  },
  {
    id: "overengineer",
    title: "Over-engineering from minute one",
    detail:
      "Opening with microservices, multi-region replication, and a service mesh for a system doing 200 RPS. Complexity you can't justify counts against you.",
    fix: "Start boring; add each component only when a number forces it. If you could delete it and nothing breaks, delete it.",
  },
  {
    id: "branddrop",
    title: "Name-dropping tech you can't defend",
    detail:
      "“We'll just use Kafka and Cassandra here.” The follow-up question is always “why?” — and the third follow-up is where it collapses.",
    fix: "Say “a message queue” or “a wide-column store” unless you can go three questions deep on the named product.",
  },
  {
    id: "silence",
    title: "Designing in silence",
    detail:
      "Thinking hard, quietly, for ninety seconds. The interviewer can only grade what they can hear — a silent right answer scores like a wrong one.",
    fix: "Narrate the reasoning, including dead ends: “I considered X, rejected it because Y.” Stuck for real? Say so and ask — that's collaboration, not weakness.",
  },
  {
    id: "hedge",
    title: "Hedging forever, deciding never",
    detail:
      "Presenting SQL vs NoSQL as a balanced essay and moving on without picking one. Interviews reward engineers who commit under uncertainty.",
    fix: "Weigh briefly, then commit with a rationale: “given these tradeoffs I'll take X, and here's what I'm giving up.”",
  },
  {
    id: "hints",
    title: "Steamrolling the hints",
    detail:
      "“Are you sure about that write path?” is not small talk — it's the interviewer handing you the answer key. Resisting a hint twice becomes a fail signal.",
    fix: "Treat every nudge as free information. Pause, re-examine the thing they pointed at, and adjust out loud.",
  },
];

// ----------------------------------------------------------------- drills

export const DRILLS = [
  {
    id: "estimation",
    icon: Calculator,
    skill: "Capacity estimation",
    exercise:
      "Build the boring four-node system (client → LB → app → DB). Predict on paper where it breaks, then crank the load slider until it does. Being wrong is the lesson.",
    to: "/sandbox",
    linkLabel: "Open the sandbox",
  },
  {
    id: "scoping",
    icon: SearchCode,
    skill: "Requirements scoping",
    exercise:
      "Open the URL-shortener brief. Before dragging a single node, write 3 functional and 2 non-functional requirements. Then check your score against the rubric — it grades exactly this.",
    to: "/challenges/url-shortener",
    linkLabel: "Start the URL shortener",
  },
  {
    id: "tradeoffs",
    icon: Scale,
    skill: "Tradeoff articulation",
    exercise:
      "Run any challenge, open your tradeoff profile, and explain each dial out loud in one sentence: what you bought, what you paid. If you can't, that dial is your gap.",
    to: "/challenges",
    linkLabel: "Pick a challenge",
  },
  {
    id: "deepdive",
    icon: Wrench,
    skill: "Deep-dive reps",
    exercise:
      "Load the Discord case study onto the canvas, set the cache hit rate to zero, and narrate what happens downstream — hop by hop, like you're on the incident call.",
    to: "/case-studies/discord-scylladb",
    linkLabel: "Break Discord's cache",
  },
  {
    id: "failure",
    icon: Siren,
    skill: "Failure-mode thinking",
    exercise:
      "Take the flash-sale challenge at full peak load. Find what dies first, fix only that, re-run. Repeat until green — that's the “what if this box dies?” muscle.",
    to: "/challenges/flash-sale-ecommerce",
    linkLabel: "Survive the flash sale",
  },
  {
    id: "mock",
    icon: Timer,
    skill: "The full 45-minute rep",
    exercise:
      "Pick a challenge you haven't seen, set a 45-minute timer, and talk the entire time — requirements, numbers, design, deep dive, wrap. Out loud, to an empty room. It works.",
    to: "/challenges",
    linkLabel: "Run a mock",
  },
];

// -------------------------------------------------------------- prep plan

export const PLAN = [
  {
    id: "week1",
    label: "Week 1 — build the base",
    items: [
      {
        id: "w1-chapters",
        text: "Read all four core chapters (~25 min total). They're the method behind everything below.",
        to: "/learn",
        linkLabel: "The Library",
      },
      {
        id: "w1-components",
        text: "Skim the 14 component cards. For each, say one sentence: “I'd reach for this when…”",
        to: "/learn",
        linkLabel: "Component library",
      },
      {
        id: "w1-beginner",
        text: "Beat both beginner challenges: the URL shortener, then the rate-limited API.",
        to: "/challenges/url-shortener",
        linkLabel: "Start here",
      },
      {
        id: "w1-predict",
        text: "Sandbox drill: build any system, predict its breaking point, then verify. Three rounds.",
        to: "/sandbox",
        linkLabel: "Sandbox",
      },
      {
        id: "w1-cases",
        text: "Read the Discord and Twitter case studies and simulate both incidents.",
        to: "/case-studies",
        linkLabel: "Case studies",
      },
    ],
  },
  {
    id: "week2",
    label: "Week 2 — pressure and polish",
    items: [
      {
        id: "w2-intermediate",
        text: "Clear the three intermediate challenges: Instagram feed, chat app, notification fan-out.",
        to: "/challenges",
        linkLabel: "Challenges",
      },
      {
        id: "w2-mock",
        text: "One advanced challenge as a full 45-minute mock, phases timed, spoken out loud.",
        to: "/challenges/youtube-streaming",
        linkLabel: "Video streaming",
      },
      {
        id: "w2-chaos",
        text: "Chaos day: take your best design into the sandbox and kill components until you can narrate every failure calmly.",
        to: "/sandbox",
        linkLabel: "Sandbox",
      },
      {
        id: "w2-phrases",
        text: "Work five lines from the phrase bank below into your next mock until they're yours.",
      },
      {
        id: "w2-dayBefore",
        text: "Day before: re-read the tradeoff chapter, warm up on one easy challenge, then stop. Sleep beats cramming.",
        to: "/learn",
        linkLabel: "Tradeoff chapter",
      },
    ],
  },
];

// ------------------------------------------------------------ phrase bank

export const PHRASES = [
  {
    group: "Scoping the problem",
    items: [
      "Let me make sure I'm solving the right problem — is this consumer-scale read-heavy traffic, or an internal tool?",
      "I'm scoping this to the top three features: creating links, redirecting, and basic analytics. Everything else I'll park unless you want it in.",
      "Before I move on — does this scope match what you had in mind?",
    ],
  },
  {
    group: "Putting numbers on it",
    items: [
      "Given reads dominate 100:1, I'll optimize the read path first and accept eventual consistency on the feed.",
      "That's roughly 1,200 RPS average — call it 5k at peak, and peak is what we design for.",
    ],
  },
  {
    group: "Building the design",
    items: [
      "I'll start deliberately boring — a load balancer, stateless app servers, one database — so we have a working baseline to scale from.",
      "I'm flagging this fan-out as the hard part. I'd rather come back to it in depth than hand-wave it now.",
      "There are two viable options here. Given the write volume, I'll commit to the queue-based approach and accept the operational cost.",
    ],
  },
  {
    group: "Going deep",
    items: [
      "The trade-off here is latency versus freshness. For a social feed, stale-by-seconds is fine; down is not.",
      "If this node dies right now, here's what the user sees — and here's the mitigation.",
      "I've seen this fail when the cache goes cold, so I'd add request coalescing on the miss path.",
    ],
  },
  {
    group: "Wrapping and recovering",
    items: [
      "The weakest part of this design is the single-region primary. With more time, that's where I'd go next.",
      "I haven't run this at real scale myself, so let me reason from first principles rather than pretend.",
      "Good push — that assumption doesn't hold. Let me rework the write path.",
    ],
  },
];
