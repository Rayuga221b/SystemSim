"""Challenge scoring — grade a user's graph against a challenge definition.

Rubric (100 points, weights chosen so that a design which USES the right
pieces but falls over under load cannot score well, and vice versa):

  35  required components   — proportional: each missing required type costs
                              its share. The most legible signal for learners.
  15  connectivity sanity   — a client exists, traffic actually reaches a
                              storage/terminal layer, and no required piece is
                              left floating off the traffic path.
  40  simulated performance — we RUN the user's graph at the challenge's
                              load_rps and workload:
                                20 throughput ratio (achieved / requested)
                                10 no overloaded/failed nodes (each costs 5)
                                10 critical-path latency within budget
  10  bonus concepts        — challenge-specific niceties (e.g. a cache on a
                              read-heavy problem), capped at 10.

Feedback is three buckets the UI renders directly:
  missing — blocks points, tells the user exactly what to add
  weak    — present but underperforming, with the numbers to prove it
  good    — reinforcement for what they got right

Pure functions, no I/O — the route feeds in the challenge dict and persists
the attempt if the caller is authenticated.
"""
from __future__ import annotations

from typing import Any

from engine.components import merged_config
from engine.simulation import SimulationEngine

# Human names for component types, for readable feedback strings.
PRETTY = {
    "client": "Client", "dns": "DNS", "cdn": "CDN", "api_gateway": "API Gateway",
    "load_balancer": "Load Balancer", "rate_limiter": "Rate Limiter",
    "app_server": "App Server", "worker": "Worker", "sql_db": "SQL Database",
    "nosql_db": "NoSQL Database", "object_storage": "Object Storage",
    "cache": "Cache", "search_index": "Search Index",
    "message_queue": "Message Queue",
}

_STORAGE_TYPES = {"sql_db", "nosql_db", "object_storage", "cache",
                  "search_index", "message_queue"}


def _node_type(graph: dict[str, Any], node_id: str) -> str | None:
    return next((n.get("type") for n in graph.get("nodes") or []
                 if n.get("id") == node_id), None)


def score_attempt(graph: dict[str, Any], challenge: dict[str, Any]) -> dict[str, Any]:
    """Return {"score": 0-100, "feedback": {"missing": [], "weak": [], "good": []}}."""
    missing: list[str] = []
    weak: list[str] = []
    good: list[str] = []

    nodes = graph.get("nodes") or []
    types_present = {n.get("type") for n in nodes}
    score = 0.0

    # ---- (a) required components: 35 pts, proportional ---------------------
    required = challenge.get("required_components", [])
    if required:
        have = [t for t in required if t in types_present]
        lack = [t for t in required if t not in types_present]
        score += 35.0 * len(have) / len(required)
        for t in lack:
            missing.append(f"No {PRETTY.get(t, t)} in your design — the "
                           f"challenge calls for one.")
        if not lack:
            good.append("All required components are present.")
    else:
        score += 35.0

    # ---- (b) connectivity sanity: 15 pts -----------------------------------
    sim_result, sim_error = _try_simulate(graph, challenge)
    score += _connectivity_points(graph, sim_result, missing, weak, good)

    # ---- (c) simulated performance: 40 pts ---------------------------------
    if sim_result is None:
        missing.append(sim_error or "Your graph could not be simulated — "
                       "add a Client and connect it to your system.")
    else:
        score += _performance_points(graph, challenge, sim_result, weak, good)

    # ---- (d) bonus concepts: 10 pts ----------------------------------------
    bonus = challenge.get("bonus_components", [])
    if bonus:
        hits = [t for t in bonus if t in types_present]
        score += min(10.0, 10.0 * len(hits) / len(bonus))
        for t in hits:
            good.append(f"Nice touch: a {PRETTY.get(t, t)} fits this problem well.")

    return {"score": int(round(max(0.0, min(100.0, score)))),
            "feedback": {"missing": missing, "weak": weak, "good": good}}


# --------------------------------------------------------------------------
def _try_simulate(graph, challenge):
    """Run the user's graph under the challenge's load. Returns (result, err)."""
    try:
        engine = SimulationEngine(graph)
        read_pct = (challenge.get("workload") or {}).get("read_pct", 80)
        return engine.run(load_rps=challenge.get("load_rps", 1000),
                          failures=None, read_pct=read_pct), None
    except ValueError as e:
        return None, f"Simulation failed: {e}"


def _connectivity_points(graph, sim_result, missing, weak, good) -> float:
    """15 pts: client present (5), traffic reaches a storage layer (5),
    nothing floating disconnected (5)."""
    pts = 0.0
    nodes = graph.get("nodes") or []
    types_present = {n.get("type") for n in nodes}

    if "client" in types_present:
        pts += 5.0
    else:
        missing.append("Add a Client node — without a traffic source there "
                       "is nothing to simulate.")

    if sim_result is not None:
        metrics = sim_result["node_metrics"]
        storage_hit = any(
            metrics.get(n["id"], {}).get("in_rps", 0) > 0
            for n in nodes if n.get("type") in _STORAGE_TYPES)
        if storage_hit:
            pts += 5.0
        elif types_present & _STORAGE_TYPES:
            weak.append("Your storage layer receives no traffic — check the "
                        "edges from your compute tier.")
        else:
            missing.append("Traffic never reaches a storage layer — add a "
                           "database or cache and wire it in.")

        floating = [w for w in sim_result["warnings"]
                    if "not connected to the traffic path" in w]
        if not floating:
            pts += 5.0
        else:
            for w in floating:
                weak.append(w.capitalize() + ".")
    return pts


def _performance_points(graph, challenge, result, weak, good) -> float:
    """40 pts from actually running the design at the challenge's load.

    Gate: traffic must actually FLOW through the design. A pile of
    disconnected components "drops nothing" (load never leaves the client),
    which would otherwise score full performance marks for doing nothing."""
    engaged = any(
        m.get("in_rps", 0) > 0
        for nid, m in result["node_metrics"].items()
        if _node_type(graph, nid) != "client")
    if not engaged:
        weak.append("Traffic never leaves your Client — connect your "
                    "components before the design can earn performance points.")
        return 0.0

    pts = 0.0
    requested = result["throughput_requested_rps"] or 1.0
    ratio = result["throughput_achieved_rps"] / requested

    # 20 pts: throughput ratio.
    pts += 20.0 * ratio
    if ratio >= 0.999:
        good.append(f"Your design serves the full "
                    f"{requested:,.0f} RPS without dropping traffic.")
    else:
        lost = requested - result["throughput_achieved_rps"]
        weak.append(f"You serve {ratio:.0%} of the target load — "
                    f"{lost:,.0f} RPS are being dropped.")

    # 10 pts: no overloaded/failed nodes; each one costs 5 and gets a
    # specific message built from its own metrics.
    hot = [nid for nid, s in result["node_statuses"].items()
           if s in ("overloaded", "failed")]
    pts += max(0.0, 10.0 - 5.0 * len(hot))
    labels = {n["id"]: (n.get("label") or PRETTY.get(n.get("type"), n["id"]))
              for n in graph.get("nodes") or []}
    for nid in hot:
        m = result["node_metrics"].get(nid, {})
        weak.append(f"{labels.get(nid, nid)} takes {m.get('in_rps', 0):,.0f} RPS "
                    f"but handles {m.get('capacity_rps', 0):,.0f} — scale it "
                    f"out or shield it with a cache/queue.")
    if not hot:
        good.append("No component is overloaded at the target load.")

    # 10 pts: latency budget.
    budget = challenge.get("latency_budget_ms")
    if budget:
        latency = result["critical_path_latency_ms"]
        if latency <= budget:
            pts += 10.0
            good.append(f"Critical path latency {latency:,.0f} ms is inside "
                        f"the {budget:,.0f} ms budget.")
        else:
            weak.append(f"Critical path latency {latency:,.0f} ms blows the "
                        f"{budget:,.0f} ms budget — shorten the chain or use "
                        f"faster tiers.")
    else:
        pts += 10.0
    return pts
