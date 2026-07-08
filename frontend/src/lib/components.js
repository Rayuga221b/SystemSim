// The 14 system components, as DATA. This is the single source of truth the
// palette, canvas nodes, and properties panel all render from.
//
// `type` strings and `fields[].key` names are a FIXED contract with the
// backend simulation engine (backend/engine) — never rename one side alone.
//
// category: "ingress" | "compute" | "storage" | "async"

import {
  Monitor, Globe, Radio, Shield, Shuffle, Gauge,
  Server, Cog, Database, Layers, HardDrive, Zap, Search, ListOrdered,
} from "lucide-react";

export const CATEGORIES = [
  { id: "ingress", label: "Ingress",  color: "#38BDF8" }, // sky-400
  { id: "compute", label: "Compute",  color: "#818CF8" }, // indigo-400
  { id: "storage", label: "Storage",  color: "#34D399" }, // emerald-400
  { id: "async",   label: "Async",    color: "#FB923C" }, // orange-400
];

export const CATEGORY_COLOR = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.color])
);

// Field shape: { key, label, type: "number"|"percent", default, min, max, step, unit, help }
export const COMPONENTS = [
  {
    type: "client",
    label: "Client",
    category: "ingress",
    icon: Monitor,
    description: "Traffic source. Emits the simulated request load downstream.",
    fields: [],
  },
  {
    type: "dns",
    label: "DNS",
    category: "ingress",
    icon: Globe,
    description: "Resolves names to addresses. Pure passthrough with fixed latency.",
    fields: [
      { key: "latency_ms", label: "Latency", type: "number", default: 5, min: 1, max: 200, step: 1, unit: "ms", help: "Resolution time added to every request." },
    ],
  },
  {
    type: "cdn",
    label: "CDN",
    category: "ingress",
    icon: Radio,
    description: "Edge cache. Absorbs a percentage of requests before they reach origin.",
    fields: [
      { key: "hit_rate", label: "Hit rate", type: "percent", default: 90, min: 0, max: 100, step: 5, unit: "%", help: "Share of requests served at the edge — the rest hit your origin." },
      { key: "latency_ms", label: "Latency", type: "number", default: 10, min: 1, max: 200, step: 1, unit: "ms", help: "Edge response time." },
    ],
  },
  {
    type: "api_gateway",
    label: "API Gateway",
    category: "ingress",
    icon: Shield,
    description: "Single entry point: auth, routing, and rate limiting for your APIs.",
    fields: [
      { key: "rate_limit", label: "Rate limit", type: "number", default: 5000, min: 100, max: 1000000, step: 100, unit: "rps", help: "Requests above this limit are rejected at the gate." },
    ],
  },
  {
    type: "load_balancer",
    label: "Load Balancer",
    category: "ingress",
    icon: Shuffle,
    description: "Splits incoming traffic evenly across the servers behind it.",
    fields: [
      { key: "capacity", label: "Capacity", type: "number", default: 50000, min: 1000, max: 10000000, step: 1000, unit: "rps", help: "Total throughput the balancer itself can handle." },
    ],
  },
  {
    type: "rate_limiter",
    label: "Rate Limiter",
    category: "ingress",
    icon: Gauge,
    description: "Hard cap on throughput. Excess requests are dropped, protecting what's behind it.",
    fields: [
      { key: "threshold", label: "Threshold", type: "number", default: 1000, min: 10, max: 1000000, step: 10, unit: "rps", help: "Maximum requests per second allowed through." },
    ],
  },
  {
    type: "app_server",
    label: "App Server",
    category: "compute",
    icon: Server,
    description: "Runs your business logic. Capacity = instances × per-instance throughput.",
    fields: [
      { key: "instances", label: "Instances", type: "number", default: 2, min: 1, max: 128, step: 1, unit: "", help: "Horizontal scale — more instances, more capacity." },
      { key: "rps_per_instance", label: "RPS / instance", type: "number", default: 500, min: 50, max: 20000, step: 50, unit: "rps", help: "Throughput a single instance sustains." },
    ],
  },
  {
    type: "worker",
    label: "Worker",
    category: "compute",
    icon: Cog,
    description: "Consumes jobs from a queue at a steady rate, off the request path.",
    fields: [
      { key: "instances", label: "Workers", type: "number", default: 1, min: 1, max: 64, step: 1, unit: "", help: "Parallel consumers draining the queue." },
      { key: "consume_rps", label: "Consume rate", type: "number", default: 500, min: 10, max: 50000, step: 10, unit: "rps", help: "Jobs one worker processes per second." },
    ],
  },
  {
    type: "sql_db",
    label: "SQL Database",
    category: "storage",
    icon: Database,
    description: "Relational store. Writes hit the primary; reads spread across replicas.",
    fields: [
      { key: "primary_capacity", label: "Primary write cap", type: "number", default: 1000, min: 100, max: 100000, step: 100, unit: "rps", help: "Write throughput of the primary — the classic bottleneck." },
      { key: "replicas", label: "Read replicas", type: "number", default: 1, min: 0, max: 16, step: 1, unit: "", help: "Copies that serve reads (eventually consistent)." },
      { key: "read_capacity_per_replica", label: "Reads / replica", type: "number", default: 2000, min: 100, max: 100000, step: 100, unit: "rps", help: "Read throughput each replica sustains." },
    ],
  },
  {
    type: "nosql_db",
    label: "NoSQL Database",
    category: "storage",
    icon: Layers,
    description: "Sharded key-value / document store. Scales horizontally, trades consistency.",
    fields: [
      { key: "shards", label: "Shards", type: "number", default: 3, min: 1, max: 64, step: 1, unit: "", help: "Partitions the data is split across." },
      { key: "rps_per_shard", label: "RPS / shard", type: "number", default: 2000, min: 100, max: 100000, step: 100, unit: "rps", help: "Throughput a single shard sustains." },
    ],
  },
  {
    type: "object_storage",
    label: "Object Storage",
    category: "storage",
    icon: HardDrive,
    description: "Blob store (S3-style). Effectively infinite capacity, higher latency.",
    fields: [
      { key: "latency_ms", label: "Latency", type: "number", default: 50, min: 5, max: 500, step: 5, unit: "ms", help: "Time to fetch an object." },
    ],
  },
  {
    type: "cache",
    label: "Cache",
    category: "storage",
    icon: Zap,
    description: "In-memory store (Redis-style). Absorbs reads before they reach the database.",
    fields: [
      { key: "hit_rate", label: "Hit rate", type: "percent", default: 80, min: 0, max: 100, step: 5, unit: "%", help: "Share of reads answered from memory — misses fall through." },
      { key: "capacity", label: "Capacity", type: "number", default: 100000, min: 1000, max: 10000000, step: 1000, unit: "rps", help: "Throughput ceiling of the cache tier." },
    ],
  },
  {
    type: "search_index",
    label: "Search Index",
    category: "storage",
    icon: Search,
    description: "Inverted index (Elasticsearch-style). Fast reads, expensive writes.",
    fields: [
      { key: "read_capacity", label: "Read capacity", type: "number", default: 3000, min: 100, max: 100000, step: 100, unit: "rps", help: "Query throughput." },
      { key: "write_limit", label: "Write limit", type: "number", default: 500, min: 10, max: 50000, step: 10, unit: "rps", help: "Indexing rate before ingestion lags." },
    ],
  },
  {
    type: "message_queue",
    label: "Message Queue",
    category: "async",
    icon: ListOrdered,
    description: "Buffer between producers and consumers. Absorbs spikes; lags if drain is too slow.",
    fields: [
      { key: "max_throughput", label: "Max throughput", type: "number", default: 50000, min: 1000, max: 10000000, step: 1000, unit: "rps", help: "Ingest ceiling of the queue itself." },
    ],
  },
];

export const COMPONENT_BY_TYPE = Object.fromEntries(
  COMPONENTS.map((c) => [c.type, c])
);

/** Default config object for a component type — mirrors backend defaults. */
export function defaultConfig(type) {
  const comp = COMPONENT_BY_TYPE[type];
  if (!comp) return {};
  return Object.fromEntries(comp.fields.map((f) => [f.key, f.default]));
}

/** Human capacity summary shown on the node face, derived from config. */
export function capacitySummary(type, config = {}) {
  const c = { ...defaultConfig(type), ...config };
  switch (type) {
    case "client":         return "traffic source";
    case "dns":            return `${c.latency_ms}ms lookup`;
    case "cdn":            return `${c.hit_rate}% edge hits`;
    case "api_gateway":    return `${fmt(c.rate_limit)} rps limit`;
    case "load_balancer":  return `${fmt(c.capacity)} rps`;
    case "rate_limiter":   return `${fmt(c.threshold)} rps cap`;
    case "app_server":     return `${c.instances}× ${fmt(c.rps_per_instance)} = ${fmt(c.instances * c.rps_per_instance)} rps`;
    case "worker":         return `${c.instances}× ${fmt(c.consume_rps)} rps drain`;
    case "sql_db":         return `${fmt(c.primary_capacity)}w · ${c.replicas} replica${c.replicas === 1 ? "" : "s"}`;
    case "nosql_db":       return `${c.shards} shards · ${fmt(c.shards * c.rps_per_shard)} rps`;
    case "object_storage": return `∞ · ${c.latency_ms}ms`;
    case "cache":          return `${c.hit_rate}% hits`;
    case "search_index":   return `${fmt(c.read_capacity)}r / ${fmt(c.write_limit)}w`;
    case "message_queue":  return `${fmt(c.max_throughput)} rps ingest`;
    default:               return "";
  }
}

export function fmt(n) {
  if (n == null) return "—";
  if (n >= 1000000) return `${+(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${+(n / 1000).toFixed(1)}k`;
  return `${n}`;
}
