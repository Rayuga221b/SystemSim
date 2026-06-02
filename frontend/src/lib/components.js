// The 14 system components, as DATA. Nodes render from this; the palette
// reads from this. Add a component here -> it appears everywhere.
// category: "ingress" | "compute" | "storage" | "async"
export const COMPONENTS = [
  { type: "client",        label: "Client",         category: "ingress", fields: ["load_rps"] },
  { type: "dns",           label: "DNS",            category: "ingress", fields: ["latency_ms"] },
  { type: "cdn",           label: "CDN",            category: "ingress", fields: ["hit_rate"] },
  { type: "api_gateway",   label: "API Gateway",    category: "ingress", fields: ["rate_limit"] },
  { type: "load_balancer", label: "Load Balancer",  category: "ingress", fields: [] },
  { type: "rate_limiter",  label: "Rate Limiter",   category: "ingress", fields: ["threshold"] },
  { type: "app_server",    label: "App Server",     category: "compute", fields: ["instances", "rps_per_instance"] },
  { type: "worker",        label: "Worker/Consumer",category: "compute", fields: ["consume_rps"] },
  { type: "sql_db",        label: "SQL Database",   category: "storage", fields: ["replicas", "primary_capacity"] },
  { type: "nosql_db",      label: "NoSQL Database", category: "storage", fields: ["shards"] },
  { type: "object_storage",label: "Object Storage", category: "storage", fields: ["latency_ms"] },
  { type: "cache",         label: "Cache (Redis)",  category: "storage", fields: ["hit_rate"] },
  { type: "search_index",  label: "Search Index",   category: "storage", fields: ["write_limit"] },
  { type: "message_queue", label: "Message Queue",  category: "async",   fields: ["consume_rate"] },
];
