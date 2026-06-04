export const CHALLENGES = [
  {
    title: "Design a URL Shortener",
    desc: "Build a system like bit.ly that handles millions of redirects per day with sub-10ms latency. Cover hashing, storage, and cache layer.",
    difficulty: "Beginner",
    time: "~25 min",
    tags: ["Hashing", "Databases", "Caching"],
  },
  {
    title: "Design a Rate Limiter",
    desc: "Protect your API from abuse. Implement token bucket, leaky bucket, and sliding window algorithms, then decide which fits your use case.",
    difficulty: "Intermediate",
    time: "~35 min",
    tags: ["Algorithms", "Redis", "Distributed Systems"],
  },
  {
    title: "Design a Chat System",
    desc: "Real-time messaging at scale: WebSocket connection management, message persistence, delivery guarantees, and multi-device sync.",
    difficulty: "Advanced",
    time: "~50 min",
    tags: ["WebSockets", "Message Queues", "Storage"],
  },
  {
    title: "Design a Notification Service",
    desc: "Push millions of notifications across mobile, email, and web with reliability guarantees, rate limiting, and per-user preference routing.",
    difficulty: "Intermediate",
    time: "~40 min",
    tags: ["Async", "Message Queues", "Fan-out"],
  },
];
