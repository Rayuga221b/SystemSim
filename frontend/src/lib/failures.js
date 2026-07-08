// Failure injection modes — mirrors backend engine contract (docs/spec.md).
// `appliesTo` limits which component types can receive each mode; null = any.
export const FAILURE_MODES = {
  node_crash: {
    label: "Crash",
    description: "Capacity drops to zero — the node is gone.",
    appliesTo: null,
    excludes: ["client"],
  },
  slow_node: {
    label: "Slow node",
    description: "Latency ×10 — degraded but alive.",
    appliesTo: null,
    excludes: ["client"],
  },
  cache_miss_spike: {
    label: "Miss spike",
    description: "Hit rate collapses to 10% — cold cache / key eviction storm.",
    appliesTo: ["cache", "cdn"],
  },
  replication_lag: {
    label: "Replication lag",
    description: "Replica reads return stale data.",
    appliesTo: ["sql_db"],
  },
  queue_backup: {
    label: "Queue backup",
    description: "Consumers drain at half speed — lag builds.",
    appliesTo: ["message_queue", "worker"],
  },
  traffic_spike: {
    label: "Traffic spike",
    description: "Incoming load doubles — the surprise launch moment.",
    appliesTo: ["client"],
  },
};

/** Failure modes applicable to a given component type. */
export function failuresFor(type) {
  return Object.entries(FAILURE_MODES)
    .filter(([, m]) => (!m.appliesTo || m.appliesTo.includes(type)) && !m.excludes?.includes(type))
    .map(([mode, m]) => ({ mode, ...m }));
}
