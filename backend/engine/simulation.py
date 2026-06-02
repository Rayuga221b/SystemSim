"""SimulationEngine — the core of SystemSim.

────────────────────────────────────────────────────────────────────────────
 SATYAM WRITES THIS FILE BY HAND.

 This is the part you want to be able to explain line-by-line in an interview:
 the BFS traversal, the Strategy pattern per component, how load propagates,
 how bottlenecks are detected, how tradeoff scores are derived.

 Below is ONLY the interface + the contract from docs/spec.md, so the rest of
 the codebase can import against a stable shape. The bodies are intentionally
 left as NotImplementedError. Do not let an assistant fill these in.
────────────────────────────────────────────────────────────────────────────

Design notes (for your own reference while implementing):

  Strategy pattern:
    Each of the 14 component types is a class exposing the SAME interface:

        process(load_rps: float, ctx) -> tuple[float, str]
        # returns (output_rps_passed_downstream, status)
        # status in {"healthy", "warning", "overloaded", "failed"}

    A registry maps node "type" -> strategy class. Traversal never special-cases
    a component; it just calls process(). Adding a 15th component = one class.

  Traversal:
    Build a NetworkX DiGraph from graph["nodes"] + graph["edges"].
    BFS from the Client (source) node. At each node, apply its strategy with the
    incoming load, record status, propagate output_rps along outgoing edges.
    Accumulate latency along the critical path.

  Failure injection (optional dict node_id -> mode) modifies the node's params
  before process(): node_crash, slow_node, cache_miss_spike, replication_lag,
  queue_backup, traffic_spike.  (See docs/spec.md.)

  Output must match the schema in docs/spec.md exactly.
"""
from typing import Any


class SimulationEngine:
    def __init__(self, graph: dict[str, Any]):
        self.graph = graph
        # TODO(Satyam): build the NetworkX DiGraph, locate the Client source node,
        #   register component strategies.
        raise NotImplementedError("Implement SimulationEngine by hand")

    def run(
        self,
        load_rps: int,
        failures: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """BFS traversal + per-node strategy. Return the spec output schema."""
        # TODO(Satyam): the heart of the project — write this yourself.
        raise NotImplementedError
