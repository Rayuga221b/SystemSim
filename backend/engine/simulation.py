"""SimulationEngine — the core of SystemSim.

What this file does
===================
Takes a system-design graph (nodes + edges, straight from the React Flow
canvas), pushes a requested load in RPS through it, and reports what breaks:
per-node statuses and metrics, bottlenecks, end-to-end latency, achieved
throughput, warnings, and tradeoff scores.

The design, in five sentences
=============================
1. STATELESS: the full graph arrives with every call; nothing is cached
   between requests, so the engine is trivially scalable and testable.
2. STRATEGY PATTERN: per-component behaviour lives in engine/components.py;
   this file only orchestrates. The traversal below never mentions a concrete
   component type except for two documented topology rules (load-balancer
   splitting and queue→worker drain discovery), which are routing concerns
   and therefore belong to the thing that owns the edges.
3. TOPOLOGICAL PROPAGATION: we process nodes in topological order (a
   multi-source BFS over a DAG collapses to exactly this), so every node sees
   its complete incoming load before it runs — no partial updates, no
   re-visits.
4. LOAD SPLITTING RULE (documented, deliberate): a load_balancer divides its
   output EVENLY across its downstream nodes; every other node sends its FULL
   output to EACH downstream node. Fan-out from an app server to both a cache
   and a queue means both see the whole request stream — modelling "every
   request touches both", which is the common real-world meaning of those
   edges. Users who want traffic divided put a load balancer there; that is
   the teaching point.
5. READ/WRITE AWARENESS: load is a WorkLoad(read_rps, write_rps) pair split
   once at the clients from workload.read_pct; caches absorb reads only, SQL
   primaries take writes only. See engine/components.py.

Edge cases handled
==================
- Cycles: detected and broken (the closing edge is ignored) with a warning —
  never an infinite loop.
- Disconnected nodes: reported healthy-but-idle with a warning, excluded from
  the critical path.
- Failure injection: per-node modes mutate the node's effective config BEFORE
  its strategy runs (crash -> capacity 0, slow_node -> latency ×10, ...), so
  strategies stay failure-agnostic. traffic_spike is global: ×2 on the
  requested load.

Throughput accounting
=====================
achieved = requested − Σ dropped across all nodes, clamped to [0, requested].
Traffic ABSORBED by a cache/CDN counts as served (the user got a response);
traffic buffered by a lagging queue also isn't "failed" — only drops (rate
limits, overload shedding, crashes) hurt the number. Because fan-out
duplicates load, the sum of drops can in pathological graphs exceed the
requested total; the clamp keeps the headline number honest.
"""
from __future__ import annotations

from typing import Any

import networkx as nx

from engine.components import (
    FAILED,
    HEALTHY,
    INFINITE,
    OVERLOADED,
    REGISTRY,
    WARNING,
    ZERO_LOAD,
    NodeContext,
    ProcessResult,
    WorkLoad,
    merged_config,
)
from engine.tradeoffs import score_tradeoffs

# Failure modes and what they touch (see docs/spec.md).
_FAILURE_MODES = {"node_crash", "slow_node", "cache_miss_spike",
                  "replication_lag", "queue_backup", "traffic_spike"}


class SimulationEngine:
    """One instance per request: build the graph in __init__, push load in run().

    Raises ValueError with a human message on malformed input; the /simulate
    route translates that into a 422.
    """

    def __init__(self, graph: dict[str, Any]):
        self.nodes: list[dict[str, Any]] = list(graph.get("nodes") or [])
        self.edges: list[dict[str, Any]] = list(graph.get("edges") or [])
        self.by_id: dict[str, dict[str, Any]] = {}
        self._input_warnings: list[str] = []

        for node in self.nodes:
            node_id = node.get("id")
            node_type = node.get("type")
            if not node_id:
                raise ValueError("every node needs an 'id'")
            if node_id in self.by_id:
                raise ValueError(f"duplicate node id '{node_id}'")
            if node_type not in REGISTRY:
                raise ValueError(f"unknown component type '{node_type}' "
                                 f"on node '{node_id}'")
            self.by_id[node_id] = node

        # Build the DiGraph. Edges pointing at unknown nodes are skipped with
        # a warning rather than failing the whole sim — the canvas can briefly
        # hold dangling edges mid-edit and we'd rather degrade gracefully.
        self.G = nx.DiGraph()
        self.G.add_nodes_from(self.by_id)
        for edge in self.edges:
            src, dst = edge.get("source"), edge.get("target")
            if src in self.by_id and dst in self.by_id and src != dst:
                self.G.add_edge(src, dst)
            else:
                self._input_warnings.append(
                    f"edge {edge.get('id', '?')} references a missing node "
                    f"or loops onto itself — ignored")

    # ------------------------------------------------------------------ run
    def run(
        self,
        load_rps: float,
        failures: dict[str, str] | None = None,
        read_pct: float = 80.0,
    ) -> dict[str, Any]:
        """Propagate load and assemble the spec output schema (+ node_metrics)."""
        failures = self._validated_failures(failures)
        warnings: list[str] = list(self._input_warnings)

        # traffic_spike is global no matter which node it was toggled on.
        requested = float(load_rps)
        if "traffic_spike" in failures.values():
            requested *= 2
            warnings.append(f"traffic spike injected — incoming load doubled "
                            f"to {requested:,.0f} RPS")

        clients = [nid for nid, n in self.by_id.items() if n["type"] == "client"]
        if not clients:
            raise ValueError("graph needs at least one client node to emit traffic")

        order, cycle_warnings = self._acyclic_order()
        warnings.extend(cycle_warnings)

        # Reachability: only nodes downstream of a client carry traffic.
        reachable: set[str] = set(clients)
        for c in clients:
            reachable |= nx.descendants(self.G, c)

        # Seed: the requested load is divided evenly among client nodes so
        # that total requested traffic equals load_rps regardless of how many
        # client boxes the user drew (documented rule).
        incoming: dict[str, WorkLoad] = {
            c: WorkLoad.from_total(requested / len(clients), read_pct)
            for c in clients
        }

        results: dict[str, ProcessResult] = {}
        for node_id in order:
            if node_id not in reachable:
                continue
            load_in = incoming.get(node_id, ZERO_LOAD)
            result = self._process_node(node_id, load_in, failures)
            results[node_id] = result
            self._distribute(node_id, result.passed, incoming)

        # Disconnected nodes: run their strategy with zero load purely to
        # surface capacity/latency in the metrics panel; status stays healthy.
        for node_id in self.by_id:
            if node_id in reachable:
                continue
            results[node_id] = self._process_node(node_id, ZERO_LOAD, failures)
            warnings.append(f"'{self._label(node_id)}' is not connected to "
                            f"the traffic path")

        return self._assemble(results, incoming, reachable, order,
                              requested, failures, warnings)

    # ----------------------------------------------------------- per-node
    def _process_node(self, node_id: str, load_in: WorkLoad,
                      failures: dict[str, str]) -> ProcessResult:
        """Apply failure injection to the node's effective config, then run
        its strategy. Strategies never see failure modes directly (except via
        the already-mutated config), which keeps them single-purpose."""
        node = self.by_id[node_id]
        node_type = node["type"]
        cfg = merged_config(node_type, node.get("config"))
        failure = failures.get(node_id)

        # node_crash short-circuits: a dead box processes nothing.
        if failure == "node_crash":
            return ProcessResult(
                passed=ZERO_LOAD, dropped_rps=load_in.total, status=FAILED,
                latency_ms=0.0, capacity_rps=0.0,
                utilization_pct=0.0,
                warnings=[f"'{self._label(node_id)}' crashed — "
                          f"{load_in.total:,.0f} RPS lost"])

        if failure == "slow_node":
            cfg["latency_ms"] = cfg.get("latency_ms", 0) * 10
        if failure == "cache_miss_spike" and "hit_rate" in cfg:
            cfg["hit_rate"] = 10.0
        if failure == "queue_backup" and "consume_rps" in cfg:
            cfg["consume_rps"] = cfg["consume_rps"] * 0.5

        ctx = NodeContext(
            node_id=node_id,
            label=self._label(node_id),
            node_type=node_type,
            config=cfg,
            failure=failure,
            downstream_count=self.G.out_degree(node_id),
            downstream_consume_rps=self._downstream_drain(node_id, failures)
            if node_type == "message_queue" else None,
        )
        result = REGISTRY[node_type].process(load_in, ctx)

        # queue_backup on the queue itself: brokers deliver at half speed.
        if failure == "queue_backup" and node_type == "message_queue":
            halved = result.passed.scaled(0.5)
            result.absorbed_rps += result.passed.total - halved.total
            result.passed = halved
            result.warnings.append(f"'{ctx.label}' consumers backed up — "
                                   f"delivery rate halved")
            if result.status == HEALTHY:
                result.status = WARNING

        # replication_lag is a data-freshness problem, not a throughput one.
        if failure == "replication_lag":
            result.warnings.append(f"'{ctx.label}' replicas lagging — reads "
                                   f"may return stale data")
            if result.status == HEALTHY:
                result.status = WARNING
        return result

    def _downstream_drain(self, queue_id: str,
                          failures: dict[str, str]) -> float | None:
        """How fast can the workers downstream of this queue drain it?
        Sum of (instances × consume_rps) over immediate worker successors,
        respecting THEIR failure modes. None if no workers sit downstream —
        the queue then acts as a plain buffer (documented in MessageQueue)."""
        workers = [s for s in self.G.successors(queue_id)
                   if self.by_id[s]["type"] == "worker"]
        if not workers:
            return None
        drain = 0.0
        for w in workers:
            mode = failures.get(w)
            if mode == "node_crash":
                continue
            cfg = merged_config("worker", self.by_id[w].get("config"))
            rate = cfg["instances"] * cfg["consume_rps"]
            if mode == "queue_backup":
                rate *= 0.5
            drain += rate
        return drain

    # ------------------------------------------------------------ topology
    def _distribute(self, node_id: str, passed: WorkLoad,
                    incoming: dict[str, WorkLoad]) -> None:
        """THE load-splitting rule (see module docstring #4):
        load_balancer -> even split across successors; everyone else -> full
        copy to each successor."""
        successors = list(self.G.successors(node_id))
        if not successors or passed.total <= 0:
            return
        if self.by_id[node_id]["type"] == "load_balancer":
            share = passed.scaled(1.0 / len(successors))
            for s in successors:
                incoming[s] = incoming.get(s, ZERO_LOAD) + share
        else:
            for s in successors:
                incoming[s] = incoming.get(s, ZERO_LOAD) + passed

    def _acyclic_order(self) -> tuple[list[str], list[str]]:
        """Topological order, breaking cycles if the user drew any.

        We iteratively find a cycle and drop its closing edge (from a working
        copy — the original graph is untouched for successor lookups... except
        traversal uses self.G, so we DO remove from self.G and warn; the edge
        genuinely cannot carry load in a one-pass model). Guaranteed to
        terminate: each pass removes one edge."""
        warnings: list[str] = []
        while True:
            try:
                cycle = nx.find_cycle(self.G, orientation="original")
            except nx.NetworkXNoCycle:
                break
            u, v = cycle[-1][0], cycle[-1][1]
            self.G.remove_edge(u, v)
            warnings.append(
                f"cycle detected ({' → '.join(e[0] for e in cycle)} → "
                f"{cycle[0][0]}) — edge {u} → {v} ignored to keep the "
                f"simulation finite")
        return list(nx.topological_sort(self.G)), warnings

    # ------------------------------------------------------------- assembly
    def _assemble(self, results, incoming, reachable, order,
                  requested, failures, warnings) -> dict[str, Any]:
        node_statuses: dict[str, str] = {}
        node_metrics: dict[str, dict[str, float]] = {}
        raw_metrics: dict[str, dict[str, float]] = {}  # inf-preserving, for tradeoffs
        total_dropped = 0.0

        for node_id, res in results.items():
            in_rps = incoming.get(node_id, ZERO_LOAD).total if node_id in reachable else 0.0
            node_statuses[node_id] = res.status
            util = 0.0 if res.utilization_pct == INFINITE else res.utilization_pct
            raw_metrics[node_id] = {
                "capacity_rps": res.capacity_rps,
                "utilization_pct": util,
            }
            node_metrics[node_id] = {
                "in_rps": round(in_rps, 1),
                "out_rps": round(res.passed.total, 1),
                "capacity_rps": 0.0 if res.capacity_rps == INFINITE
                else round(res.capacity_rps, 1),  # 0 == unlimited (documented)
                "utilization_pct": round(min(util, 999.9), 1),
                "latency_ms": round(res.latency_ms, 1),
            }
            if node_id in reachable:
                total_dropped += res.dropped_rps
            warnings.extend(res.warnings)

        # Critical path latency: longest (slowest) root-to-sink path through
        # the traffic-carrying subgraph. DP over topological order — each
        # node's distance = its own latency + slowest predecessor. We use the
        # worst case (e.g. the cache-MISS path) because that's the latency
        # you design around.
        dist: dict[str, float] = {}
        for node_id in order:
            if node_id not in reachable:
                continue
            preds = [dist[p] for p in self.G.predecessors(node_id) if p in dist]
            dist[node_id] = results[node_id].latency_ms + (max(preds) if preds else 0.0)
        critical_path = max(dist.values()) if dist else 0.0

        # Bottlenecks: the nodes actually limiting the system, hottest first.
        def _heat(nid: str) -> float:
            return (INFINITE if node_statuses[nid] == FAILED
                    else raw_metrics[nid]["utilization_pct"])
        bottlenecks = sorted(
            (nid for nid in reachable
             if node_statuses[nid] in (OVERLOADED, FAILED)),
            key=_heat, reverse=True)

        achieved = max(0.0, min(requested, requested - total_dropped))

        tradeoffs = score_tradeoffs(
            nodes=self.nodes,
            node_metrics=raw_metrics,
            node_statuses=node_statuses,
            critical_path_latency_ms=critical_path,
            failures=failures,
        )

        return {
            "node_statuses": node_statuses,
            "node_metrics": node_metrics,
            "critical_path_latency_ms": round(critical_path, 1),
            "bottlenecks": bottlenecks,
            "throughput_achieved_rps": round(achieved, 1),
            "throughput_requested_rps": round(requested, 1),
            "tradeoffs": tradeoffs,
            "warnings": warnings,
        }

    # -------------------------------------------------------------- helpers
    def _label(self, node_id: str) -> str:
        node = self.by_id[node_id]
        return node.get("label") or f"{node['type']} {node_id}"

    @staticmethod
    def _validated_failures(failures: dict[str, str] | None) -> dict[str, str]:
        failures = failures or {}
        for node_id, mode in failures.items():
            if mode not in _FAILURE_MODES:
                raise ValueError(f"unknown failure mode '{mode}' on node "
                                 f"'{node_id}' (valid: {sorted(_FAILURE_MODES)})")
        return failures
