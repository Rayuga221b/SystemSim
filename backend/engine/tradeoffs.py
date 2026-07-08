"""Tradeoff scoring — turn a graph + simulation outcome into CAP-style dials.

Design intent
=============
These are HEURISTICS, not physics. Each score is a 0-100 number derived from
structural facts about the graph (what components exist, how they're
configured) plus a few runtime facts from the simulation (utilization,
critical-path latency). Every rule is written as "signal -> points" so the
whole function reads like the rubric it is, and each rule is defensible in an
interview:

- availability : redundancy. Single boxes die; fleets, replicas, buffers and
                 edge caches keep serving through failures.
- consistency  : how easy it is to read stale data. Every cache layer,
                 replica, and eventually-consistent store is a place where a
                 read can lag a write.
- scalability  : headroom NOW (how hot the hottest node runs at this load)
                 plus whether the horizontal-scaling primitives (LB, shards,
                 queues, multi-instance tiers) are even present.
- latency      : straight mapping of the simulated critical-path latency onto
                 0-100 (fast round trips score high).
- cost         : rough spend proxy — count boxes and the instances/replicas/
                 shards inside them. Buckets, not dollars.
- complexity   : operational surface — distinct technologies × node count.

All inputs come from the engine so this module stays pure and unit-testable.
"""
from __future__ import annotations

from typing import Any

from engine.components import INFINITE, merged_config


def _clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> int:
    return int(round(max(lo, min(hi, value))))


def score_tradeoffs(
    nodes: list[dict[str, Any]],
    node_metrics: dict[str, dict[str, float]],
    node_statuses: dict[str, str],
    critical_path_latency_ms: float,
    failures: dict[str, str],
) -> dict[str, Any]:
    """Compute the six tradeoff dials. See module docstring for rationale."""
    types = [n.get("type", "") for n in nodes]
    type_set = set(types)
    cfg = {n["id"]: merged_config(n.get("type", ""), n.get("config"))
           for n in nodes}

    def nodes_of(t: str) -> list[dict[str, Any]]:
        return [n for n in nodes if n.get("type") == t]

    # ---- structural facts reused by several dials ------------------------
    has_lb = "load_balancer" in type_set
    has_cache_layer = bool(type_set & {"cache", "cdn"})
    has_queue = "message_queue" in type_set
    multi_instance_compute = any(
        cfg[n["id"]].get("instances", 1) >= 2
        for n in nodes if n.get("type") in ("app_server", "worker"))
    sql_replicated = any(cfg[n["id"]].get("replicas", 0) >= 1
                         for n in nodes_of("sql_db"))
    nosql_sharded = any(cfg[n["id"]].get("shards", 1) >= 2
                        for n in nodes_of("nosql_db"))
    lone_app_server = (len(nodes_of("app_server")) == 1 and
                       cfg[nodes_of("app_server")[0]["id"]].get("instances", 1) < 2
                       ) if nodes_of("app_server") else False

    # ---- availability ----------------------------------------------------
    # Base 30 (a working system exists), then reward each redundancy layer.
    availability = 30.0
    availability += 20 if has_lb else 0                  # traffic can reroute
    availability += 15 if multi_instance_compute else 0  # one VM dying != outage
    availability += 15 if (sql_replicated or nosql_sharded) else 0  # data survives
    availability += 10 if has_queue else 0               # absorbs downstream death
    availability += 10 if has_cache_layer else 0         # serves through origin pain
    availability -= 25 if lone_app_server else 0         # single point of failure
    # A currently-failing system is not available, whatever its architecture.
    if any(s in ("overloaded", "failed") for s in node_statuses.values()):
        availability -= 20

    # ---- consistency -------------------------------------------------------
    # Start perfect; every place a read can be stale costs points.
    consistency = 100.0
    consistency -= 15 * min(2, types.count("cache") + types.count("cdn"))
    consistency -= 20 if "nosql_db" in type_set else 0   # eventual consistency
    consistency -= 15 if sql_replicated else 0           # replication lag window
    consistency -= 10 if "replication_lag" in failures.values() else 0
    consistency -= 5 if has_queue else 0                 # async = read-your-write gap

    # ---- scalability -------------------------------------------------------
    # Headroom: how hot does the hottest finite node run at the CURRENT load?
    finite_utils = [m["utilization_pct"] for m in node_metrics.values()
                    if m["capacity_rps"] not in (0, INFINITE)
                    and m["utilization_pct"] > 0]
    peak_util = max(finite_utils) if finite_utils else 0.0
    headroom = max(0.0, 100.0 - min(peak_util, 100.0))  # 0 when anything is maxed
    scalability = 0.5 * headroom
    scalability += 15 if has_lb else 0
    scalability += 10 if nosql_sharded else 0
    scalability += 10 if has_queue else 0
    scalability += 10 if multi_instance_compute else 0
    scalability += 5 if has_cache_layer else 0

    # ---- latency -----------------------------------------------------------
    # <=50ms critical path -> 100; >=500ms -> 0; linear in between.
    L = critical_path_latency_ms
    latency = 100.0 if L <= 50 else (0.0 if L >= 500 else
                                     100.0 * (500 - L) / 450.0)

    # ---- cost --------------------------------------------------------------
    # 1 unit per box + extra units for horizontal width you pay for.
    cost_units = 0.0
    for n in nodes:
        c = cfg[n["id"]]
        cost_units += 1
        cost_units += max(0, c.get("instances", 1) - 1)
        cost_units += c.get("replicas", 0)
        cost_units += max(0, c.get("shards", 1) - 1)
    cost = "low" if cost_units <= 8 else ("medium" if cost_units <= 18 else "high")

    # ---- complexity ----------------------------------------------------------
    # Ops burden grows with distinct technologies and sheer node count.
    distinct, count = len(type_set), len(nodes)
    if distinct <= 4 and count <= 6:
        complexity = "low"
    elif distinct >= 8 or count >= 14:
        complexity = "high"
    else:
        complexity = "medium"

    return {
        "consistency": _clamp(consistency),
        "availability": _clamp(availability),
        "scalability": _clamp(scalability),
        "latency": _clamp(latency),
        "cost": cost,
        "complexity": complexity,
    }
