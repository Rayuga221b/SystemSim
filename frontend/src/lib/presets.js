// Starter graphs for the sandbox — engine-shape graph JSON (loadGraph handles
// layout positions). Small, instructive, and they simulate meaningfully.
export const PRESETS = [
  {
    id: "basic-web",
    label: "Basic web app",
    hint: "Client → LB → app servers → SQL. The canonical starting point.",
    load_rps: 1500,
    graph: {
      nodes: [
        { id: "client_1", type: "client", label: "Users", position: { x: 40, y: 220 } },
        { id: "lb_1", type: "load_balancer", label: "Load Balancer", position: { x: 280, y: 220 } },
        { id: "app_1", type: "app_server", label: "App Server A", config: { instances: 2, rps_per_instance: 500 }, position: { x: 520, y: 120 } },
        { id: "app_2", type: "app_server", label: "App Server B", config: { instances: 2, rps_per_instance: 500 }, position: { x: 520, y: 320 } },
        { id: "sql_1", type: "sql_db", label: "Postgres", config: { replicas: 1 }, position: { x: 780, y: 220 } },
      ],
      edges: [
        { source: "client_1", target: "lb_1" },
        { source: "lb_1", target: "app_1" },
        { source: "lb_1", target: "app_2" },
        { source: "app_1", target: "sql_1" },
        { source: "app_2", target: "sql_1" },
      ],
    },
  },
  {
    id: "read-heavy-cache",
    label: "Read-heavy + cache",
    hint: "A cache tier absorbing reads before the database. Try killing the cache.",
    load_rps: 8000,
    graph: {
      nodes: [
        { id: "client_1", type: "client", label: "Users", position: { x: 40, y: 220 } },
        { id: "cdn_1", type: "cdn", label: "CDN", config: { hit_rate: 60 }, position: { x: 260, y: 220 } },
        { id: "lb_1", type: "load_balancer", label: "Load Balancer", position: { x: 480, y: 220 } },
        { id: "app_1", type: "app_server", label: "API", config: { instances: 6, rps_per_instance: 600 }, position: { x: 700, y: 220 } },
        { id: "cache_1", type: "cache", label: "Redis", config: { hit_rate: 85 }, position: { x: 920, y: 120 } },
        { id: "sql_1", type: "sql_db", label: "Postgres", config: { replicas: 2 }, position: { x: 1140, y: 220 } },
      ],
      edges: [
        { source: "client_1", target: "cdn_1" },
        { source: "cdn_1", target: "lb_1" },
        { source: "lb_1", target: "app_1" },
        { source: "app_1", target: "cache_1" },
        { source: "cache_1", target: "sql_1" },
      ],
    },
  },
  {
    id: "async-pipeline",
    label: "Async write pipeline",
    hint: "Queue + workers decoupling spiky writes from the database.",
    load_rps: 4000,
    graph: {
      nodes: [
        { id: "client_1", type: "client", label: "Producers", position: { x: 40, y: 220 } },
        { id: "gw_1", type: "api_gateway", label: "API Gateway", config: { rate_limit: 10000 }, position: { x: 260, y: 220 } },
        { id: "app_1", type: "app_server", label: "Ingest API", config: { instances: 4, rps_per_instance: 1200 }, position: { x: 480, y: 220 } },
        { id: "mq_1", type: "message_queue", label: "Kafka", position: { x: 700, y: 220 } },
        { id: "wk_1", type: "worker", label: "Consumers", config: { instances: 4, consume_rps: 800 }, position: { x: 920, y: 220 } },
        { id: "nosql_1", type: "nosql_db", label: "Cassandra", config: { shards: 4 }, position: { x: 1140, y: 220 } },
      ],
      edges: [
        { source: "client_1", target: "gw_1" },
        { source: "gw_1", target: "app_1" },
        { source: "app_1", target: "mq_1" },
        { source: "mq_1", target: "wk_1" },
        { source: "wk_1", target: "nosql_1" },
      ],
    },
  },
];
