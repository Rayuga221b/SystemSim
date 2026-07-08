"""Component strategies — the Strategy pattern half of the simulation engine.

Design intent
=============
Every one of the 14 component types is a small class exposing ONE interface:

    process(load: WorkLoad, ctx: NodeContext) -> ProcessResult

The traversal (engine/simulation.py) never special-cases a component type.
It looks the type up in REGISTRY, calls process(), and moves on. Adding a
15th component means writing one new class here and adding it to REGISTRY —
zero edits to the traversal. That is the whole point of the pattern.

Key vocabulary
==============
- WorkLoad     : load is not a single number — it is (read_rps, write_rps).
                 Caches absorb reads only; SQL primaries take writes only.
                 Carrying the split through the graph makes those semantics
                 possible without any component knowing about any other.
- ProcessResult: what a component did with its incoming load. Three buckets:
                   passed    -> forwarded downstream (misses, processed work)
                   absorbed  -> served HERE, successfully (cache/CDN hits,
                                queue buffering). Counts as achieved traffic.
                   dropped   -> rejected/lost (rate limits, overload).
                                Counts against achieved throughput.
                 Invariant: passed.total + absorbed + dropped == incoming total.
- NodeContext  : everything a strategy may need that isn't the load itself —
                 merged config, the node's failure injection (if any), and a
                 little topology info (e.g. a queue needs to know how fast its
                 downstream workers drain).

Config defaults live in DEFAULTS below — ONE place, per the project rule.
The `type` strings and config keys are a FIXED contract with the frontend;
do not rename them.
"""
from __future__ import annotations

from dataclasses import dataclass, field

# ---------------------------------------------------------------------------
# Statuses (spec): utilization <80% healthy, 80-100% warning, >100% overloaded,
# "failed" only via failure injection (node_crash).
# ---------------------------------------------------------------------------
HEALTHY = "healthy"
WARNING = "warning"
OVERLOADED = "overloaded"
FAILED = "failed"

INFINITE = float("inf")


def classify(utilization_pct: float) -> str:
    """Map a utilization percentage to a node status per the spec thresholds."""
    if utilization_pct > 100:
        return OVERLOADED
    if utilization_pct >= 80:
        return WARNING
    return HEALTHY


# ---------------------------------------------------------------------------
# Config defaults — the ONE place defaults live. A node's config dict from the
# frontend is merged over these; missing keys silently fall back.
# ---------------------------------------------------------------------------
DEFAULTS: dict[str, dict[str, float]] = {
    "client":         {},
    "dns":            {"latency_ms": 5},
    "cdn":            {"hit_rate": 90, "latency_ms": 10},
    "api_gateway":    {"rate_limit": 5000, "latency_ms": 5},
    "load_balancer":  {"capacity": 50000, "latency_ms": 2},
    "rate_limiter":   {"threshold": 1000, "latency_ms": 1},
    "app_server":     {"instances": 2, "rps_per_instance": 500, "latency_ms": 20},
    "worker":         {"instances": 1, "consume_rps": 500, "latency_ms": 10},
    "sql_db":         {"primary_capacity": 1000, "replicas": 1,
                       "read_capacity_per_replica": 2000, "latency_ms": 10},
    "nosql_db":       {"shards": 3, "rps_per_shard": 2000, "latency_ms": 5},
    "object_storage": {"latency_ms": 50},
    "cache":          {"hit_rate": 80, "capacity": 100000, "latency_ms": 2},
    "search_index":   {"read_capacity": 3000, "write_limit": 500, "latency_ms": 15},
    "message_queue":  {"max_throughput": 50000, "latency_ms": 5},
}


@dataclass(frozen=True)
class WorkLoad:
    """Load in requests-per-second, split into reads and writes.

    Frozen (immutable) on purpose: load values flow through the graph and are
    combined/scaled constantly; immutability rules out an entire class of
    aliasing bugs where two nodes accidentally share and mutate one object.
    """
    read_rps: float = 0.0
    write_rps: float = 0.0

    @property
    def total(self) -> float:
        return self.read_rps + self.write_rps

    @classmethod
    def from_total(cls, total_rps: float, read_pct: float) -> "WorkLoad":
        """Split a raw RPS number into reads/writes by the workload's read %."""
        read = total_rps * (read_pct / 100.0)
        return cls(read_rps=read, write_rps=total_rps - read)

    def scaled(self, factor: float) -> "WorkLoad":
        """Uniformly scale both halves — used for splitting and for shedding
        excess load proportionally (we assume drops don't discriminate)."""
        return WorkLoad(self.read_rps * factor, self.write_rps * factor)

    def __add__(self, other: "WorkLoad") -> "WorkLoad":
        return WorkLoad(self.read_rps + other.read_rps,
                        self.write_rps + other.write_rps)


ZERO_LOAD = WorkLoad(0.0, 0.0)


@dataclass
class ProcessResult:
    """What a component did with its incoming load. See module docstring for
    the passed/absorbed/dropped accounting invariant."""
    passed: WorkLoad = ZERO_LOAD
    absorbed_rps: float = 0.0
    dropped_rps: float = 0.0
    status: str = HEALTHY
    latency_ms: float = 0.0
    capacity_rps: float = INFINITE
    utilization_pct: float = 0.0
    warnings: list[str] = field(default_factory=list)


@dataclass
class NodeContext:
    """Per-node info handed to a strategy alongside the load.

    config is the node's config ALREADY merged over DEFAULTS (and already
    mutated by failure injection — e.g. slow_node multiplied latency_ms by 10
    before we got here), so strategies read plain values and stay dumb.
    """
    node_id: str
    label: str
    node_type: str
    config: dict[str, float]
    failure: str | None = None
    downstream_count: int = 0
    # Sum of downstream workers' drain rate; None when the queue has no worker
    # downstream (then it just passes messages through — see MessageQueue).
    downstream_consume_rps: float | None = None


# ---------------------------------------------------------------------------
# Shared math: the capacity-limited passthrough.
#
# Most components are "a pipe with a ceiling": pass what fits, drop the rest,
# report utilization. Factoring it out keeps every strategy tiny and makes the
# overload semantics identical everywhere (excess shed PROPORTIONALLY across
# reads and writes — a saturated server doesn't get to choose which requests
# to fail).
# ---------------------------------------------------------------------------
def capped_passthrough(load: WorkLoad, capacity: float, latency_ms: float,
                       label: str, drop_verb: str = "drops") -> ProcessResult:
    total = load.total
    if capacity == INFINITE:
        return ProcessResult(passed=load, latency_ms=latency_ms,
                             capacity_rps=INFINITE, utilization_pct=0.0)
    if capacity <= 0:
        # Crashed / zero-capacity node: everything incoming is lost.
        return ProcessResult(passed=ZERO_LOAD, dropped_rps=total, status=OVERLOADED,
                             latency_ms=latency_ms, capacity_rps=0.0,
                             utilization_pct=INFINITE if total > 0 else 0.0,
                             warnings=[f"{label} has zero capacity — all "
                                       f"{total:,.0f} RPS lost"])
    util = (total / capacity) * 100.0
    if total <= capacity:
        return ProcessResult(passed=load, status=classify(util),
                             latency_ms=latency_ms, capacity_rps=capacity,
                             utilization_pct=util)
    kept = load.scaled(capacity / total)
    dropped = total - capacity
    return ProcessResult(
        passed=kept, dropped_rps=dropped, status=OVERLOADED,
        latency_ms=latency_ms, capacity_rps=capacity, utilization_pct=util,
        warnings=[f"{label} {drop_verb} {dropped:,.0f} RPS "
                  f"({total:,.0f} in vs {capacity:,.0f} capacity)"])


# ---------------------------------------------------------------------------
# The 14 strategies. One class per component type; REGISTRY at the bottom.
# ---------------------------------------------------------------------------
class ComponentStrategy:
    """Interface. Subclasses set type_name and implement process()."""
    type_name: str = ""

    def process(self, load: WorkLoad, ctx: NodeContext) -> ProcessResult:
        raise NotImplementedError


class Client(ComponentStrategy):
    """Traffic source. The traversal seeds it with the requested load; it just
    emits everything downstream with no latency and no capacity."""
    type_name = "client"

    def process(self, load: WorkLoad, ctx: NodeContext) -> ProcessResult:
        return ProcessResult(passed=load, latency_ms=0.0)


class DNS(ComponentStrategy):
    """Pure passthrough that only costs latency (a resolver lookup)."""
    type_name = "dns"

    def process(self, load: WorkLoad, ctx: NodeContext) -> ProcessResult:
        return ProcessResult(passed=load, latency_ms=ctx.config["latency_ms"])


class CDN(ComponentStrategy):
    """Edge cache: absorbs hit_rate% of READS (cached content is read content);
    writes always pass through to origin. Absorbed traffic is SERVED — it
    counts toward achieved throughput and never reaches the origin."""
    type_name = "cdn"

    def process(self, load: WorkLoad, ctx: NodeContext) -> ProcessResult:
        hit_rate = ctx.config["hit_rate"] / 100.0
        hits = load.read_rps * hit_rate
        passed = WorkLoad(load.read_rps - hits, load.write_rps)
        return ProcessResult(passed=passed, absorbed_rps=hits,
                             latency_ms=ctx.config["latency_ms"])


class APIGateway(ComponentStrategy):
    """Applies rate_limit: traffic above it is dropped, remainder passes."""
    type_name = "api_gateway"

    def process(self, load: WorkLoad, ctx: NodeContext) -> ProcessResult:
        return capped_passthrough(load, ctx.config["rate_limit"],
                                  ctx.config["latency_ms"], ctx.label,
                                  drop_verb="rate-limits")


class LoadBalancer(ComponentStrategy):
    """Capacity-checked passthrough. The even SPLIT across downstream nodes is
    a routing decision, so it lives in the traversal (which owns the edges),
    not here — this class only models the LB box itself saturating."""
    type_name = "load_balancer"

    def process(self, load: WorkLoad, ctx: NodeContext) -> ProcessResult:
        return capped_passthrough(load, ctx.config["capacity"],
                                  ctx.config["latency_ms"], ctx.label)


class RateLimiter(ComponentStrategy):
    """Hard cap at threshold; excess is dropped by design (that's its job)."""
    type_name = "rate_limiter"

    def process(self, load: WorkLoad, ctx: NodeContext) -> ProcessResult:
        return capped_passthrough(load, ctx.config["threshold"],
                                  ctx.config["latency_ms"], ctx.label,
                                  drop_verb="rejects")


class AppServer(ComponentStrategy):
    """Horizontal compute tier: capacity = instances × rps_per_instance."""
    type_name = "app_server"

    def process(self, load: WorkLoad, ctx: NodeContext) -> ProcessResult:
        capacity = ctx.config["instances"] * ctx.config["rps_per_instance"]
        return capped_passthrough(load, capacity, ctx.config["latency_ms"],
                                  ctx.label)


class Worker(ComponentStrategy):
    """Queue consumer: drains at instances × consume_rps, forwards downstream
    (e.g. to the database it writes results into)."""
    type_name = "worker"

    def process(self, load: WorkLoad, ctx: NodeContext) -> ProcessResult:
        capacity = ctx.config["instances"] * ctx.config["consume_rps"]
        return capped_passthrough(load, capacity, ctx.config["latency_ms"],
                                  ctx.label)


class SQLDatabase(ComponentStrategy):
    """The one component where the read/write split really pays off:
      - WRITES go to the primary only  -> capacity = primary_capacity
      - READS  fan out across replicas -> capacity = replicas × per-replica
    Utilization is the WORSE of the two paths, because either one saturating
    takes the database down for that traffic class. With replicas=0 we let the
    primary serve reads at one replica's rate (a lone primary still answers
    SELECTs) — documented simplification."""
    type_name = "sql_db"

    def process(self, load: WorkLoad, ctx: NodeContext) -> ProcessResult:
        cfg = ctx.config
        write_cap = cfg["primary_capacity"]
        read_cap = max(cfg["replicas"], 1) * cfg["read_capacity_per_replica"]
        latency = cfg["latency_ms"]

        write_util = (load.write_rps / write_cap * 100.0) if write_cap > 0 else INFINITE
        read_util = (load.read_rps / read_cap * 100.0) if read_cap > 0 else INFINITE
        util = max(write_util, read_util)

        served_w = min(load.write_rps, write_cap)
        served_r = min(load.read_rps, read_cap)
        dropped = (load.write_rps - served_w) + (load.read_rps - served_r)

        warnings: list[str] = []
        if load.write_rps > write_cap:
            warnings.append(
                f"{ctx.label} primary takes {load.write_rps:,.0f} write RPS but "
                f"handles {write_cap:,.0f} — shard, queue writes, or scale up")
        if load.read_rps > read_cap:
            warnings.append(
                f"{ctx.label} replicas take {load.read_rps:,.0f} read RPS but "
                f"handle {read_cap:,.0f} — add replicas or a cache")

        # capacity_rps reported as the combined ceiling for the metrics panel.
        return ProcessResult(passed=WorkLoad(served_r, served_w),
                             dropped_rps=dropped, status=classify(util),
                             latency_ms=latency, capacity_rps=write_cap + read_cap,
                             utilization_pct=util, warnings=warnings)


class NoSQLDatabase(ComponentStrategy):
    """Sharded store: reads and writes both spread across shards, so it's a
    plain capacity pipe of shards × rps_per_shard. The price you pay is
    consistency, which the tradeoff scorer charges for — not this class."""
    type_name = "nosql_db"

    def process(self, load: WorkLoad, ctx: NodeContext) -> ProcessResult:
        capacity = ctx.config["shards"] * ctx.config["rps_per_shard"]
        return capped_passthrough(load, capacity, ctx.config["latency_ms"],
                                  ctx.label)


class ObjectStorage(ComponentStrategy):
    """S3-style blob store: effectively infinite capacity, notable latency."""
    type_name = "object_storage"

    def process(self, load: WorkLoad, ctx: NodeContext) -> ProcessResult:
        return ProcessResult(passed=load, latency_ms=ctx.config["latency_ms"])


class Cache(ComponentStrategy):
    """Redis-style cache. Two rules, applied in order:
      1. Capacity check on TOTAL incoming rps (an overwhelmed cache drops).
      2. Of the surviving READS, hit_rate% are absorbed (served here);
         misses + all writes pass downstream (write-through behaviour).
    Failure mode cache_miss_spike just rewrites hit_rate to 10 upstream of us,
    so this code has no failure-specific branches."""
    type_name = "cache"

    def process(self, load: WorkLoad, ctx: NodeContext) -> ProcessResult:
        capacity = ctx.config["capacity"]
        latency = ctx.config["latency_ms"]
        total = load.total
        util = (total / capacity * 100.0) if capacity > 0 else INFINITE

        surviving, dropped, warnings = load, 0.0, []
        if capacity > 0 and total > capacity:
            surviving = load.scaled(capacity / total)
            dropped = total - capacity
            warnings.append(f"{ctx.label} over capacity — dropping "
                            f"{dropped:,.0f} RPS")

        hits = surviving.read_rps * (ctx.config["hit_rate"] / 100.0)
        passed = WorkLoad(surviving.read_rps - hits, surviving.write_rps)
        return ProcessResult(passed=passed, absorbed_rps=hits,
                             dropped_rps=dropped, status=classify(util),
                             latency_ms=latency, capacity_rps=capacity,
                             utilization_pct=util, warnings=warnings)


class SearchIndex(ComponentStrategy):
    """Read-optimized index: separate read capacity and (much smaller) write
    limit. Indexing writes above write_limit are dropped with a warning —
    the spec's 'warns if write throughput exceeds index limit'."""
    type_name = "search_index"

    def process(self, load: WorkLoad, ctx: NodeContext) -> ProcessResult:
        cfg = ctx.config
        read_cap, write_cap = cfg["read_capacity"], cfg["write_limit"]
        read_util = (load.read_rps / read_cap * 100.0) if read_cap > 0 else INFINITE
        write_util = (load.write_rps / write_cap * 100.0) if write_cap > 0 else INFINITE
        util = max(read_util, write_util)

        served_r = min(load.read_rps, read_cap)
        served_w = min(load.write_rps, write_cap)
        dropped = (load.read_rps - served_r) + (load.write_rps - served_w)
        warnings = []
        if load.write_rps > write_cap:
            warnings.append(f"{ctx.label} write throughput {load.write_rps:,.0f} "
                            f"RPS exceeds index limit {write_cap:,.0f} — "
                            f"batch writes through a queue")
        return ProcessResult(passed=WorkLoad(served_r, served_w),
                             dropped_rps=dropped, status=classify(util),
                             latency_ms=cfg["latency_ms"],
                             capacity_rps=read_cap + write_cap,
                             utilization_pct=util, warnings=warnings)


class MessageQueue(ComponentStrategy):
    """Buffer between producers and workers. Three regimes:
      - produce > max_throughput          -> the broker itself saturates: drop.
      - produce > downstream drain rate   -> nothing is LOST, but the backlog
        grows without bound: buffer the excess (absorbed), warn about lag,
        status at least 'warning'. This is the spec's 'shows lag' behaviour.
      - otherwise                         -> clean passthrough.
    downstream_consume_rps is computed by the traversal (sum of downstream
    workers' drain rates). If no worker sits downstream, the queue simply
    passes messages through — modelling it as a dumb buffer, documented rule."""
    type_name = "message_queue"

    def process(self, load: WorkLoad, ctx: NodeContext) -> ProcessResult:
        result = capped_passthrough(load, ctx.config["max_throughput"],
                                    ctx.config["latency_ms"], ctx.label,
                                    drop_verb="drops")
        drain = ctx.downstream_consume_rps
        if drain is not None and result.passed.total > drain:
            lag = result.passed.total - drain
            kept = (result.passed.scaled(drain / result.passed.total)
                    if drain > 0 else ZERO_LOAD)
            result.absorbed_rps += lag          # queued, not lost
            result.passed = kept
            result.warnings.append(
                f"{ctx.label} lag growing at {lag:,.0f} msg/s — producers "
                f"outpace workers ({load.total:,.0f} in vs {drain:,.0f} drain)")
            if result.status == HEALTHY:
                result.status = WARNING
        return result


# type string -> strategy instance. Strategies are stateless, so one shared
# instance per type is safe (all per-call state travels in load/ctx).
REGISTRY: dict[str, ComponentStrategy] = {
    cls.type_name: cls()
    for cls in (Client, DNS, CDN, APIGateway, LoadBalancer, RateLimiter,
                AppServer, Worker, SQLDatabase, NoSQLDatabase, ObjectStorage,
                Cache, SearchIndex, MessageQueue)
}


def merged_config(node_type: str, config: dict | None) -> dict[str, float]:
    """Merge a node's (possibly partial, possibly None) config over DEFAULTS.
    Unknown keys are kept (harmless); known keys are coerced to float."""
    merged: dict[str, float] = dict(DEFAULTS.get(node_type, {}))
    for key, value in (config or {}).items():
        try:
            merged[key] = float(value)
        except (TypeError, ValueError):
            continue  # ignore junk config values rather than crash a sim
    return merged
