"""AI simulation explainer — runs on the Groq provider.

DECISION (2026-07-26): the explainer runs on Groq `llama-3.3-70b-versatile`
(services/groq.py) — the key with usable quota — superseding the 2026-07-25
Gemini decision. The Claude client stays untouched for the mentor feature;
swapping the explainer to any provider remains a one-import change here.

Context-scoped by design (project rule): every prompt carries the concrete
graph + simulation result — never open-ended chat. The graph is serialized to
a compact line-per-node text form (not raw JSON) to keep token cost small and
predictable, and the response uses Groq JSON mode (+ the schema injected into
the prompt) so the answer is parseable structured JSON the frontend renders
directly: summary, per-bottleneck WHY + fix, suggested fixes.

No GROQ_API_KEY -> AIUnavailable -> the route's 503 -> the frontend's
friendly "not configured" note. Same graceful-degradation contract as Claude.
"""
from __future__ import annotations

import json
from typing import Any

from services.groq import AIUnavailable, generate_json

# Response schema — steers the model's JSON shape (Groq JSON mode guarantees
# syntax; _validate below stays the shape backstop). propertyOrdering makes
# the model write the summary first, so it commits to a verdict before
# arguing the details.
_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "bottlenecks": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "node_id": {"type": "string"},
                    "label": {"type": "string"},
                    "why": {"type": "string"},
                    "fix": {"type": "string"},
                },
                "required": ["node_id", "label", "why", "fix"],
                "propertyOrdering": ["node_id", "label", "why", "fix"],
            },
        },
        "suggested_fixes": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["summary", "bottlenecks", "suggested_fixes"],
    "propertyOrdering": ["summary", "bottlenecks", "suggested_fixes"],
}

_SYSTEM = (
    "You are a pragmatic distributed-systems mentor inside SystemSim, a "
    "system-design simulator. The user simulated the architecture below and "
    "you explain the outcome. Rules:\n"
    "- Ground EVERY claim in the numbers provided (rps, capacity, utilization). "
    "Never invent components or metrics that aren't in the context.\n"
    "- `summary`: 2-3 plain sentences — the verdict and the single most "
    "important thing to understand about this result.\n"
    "- `bottlenecks`: one entry per bottlenecked/overloaded node (use its "
    "exact node_id and label from the context). `why` explains the mechanism "
    "in 1-2 sentences (e.g. which traffic path saturates and why), `fix` is "
    "one concrete change to THIS diagram. If nothing bottlenecks, return an "
    "empty array.\n"
    "- `suggested_fixes`: 1-3 short, highest-impact next steps overall, most "
    "impactful first. If the design is healthy, suggest what to stress next "
    "(more load, a failure injection) instead.\n"
    "- Talk like a helpful senior engineer: plain language, no headers, no "
    "hedging, no restating raw numbers the user already sees."
)

# Generous ceiling: the visible JSON stays small (the schema + prompt keep it
# tight); this cap only guards against runaway cost.
_MAX_TOKENS = 4096


def _serialize_graph(graph: dict[str, Any]) -> str:
    """Compact line-per-node text — smaller and easier for the model to ground
    against than raw canvas JSON (no positions, no React Flow noise)."""
    lines = ["NODES (id | type | label | config):"]
    for n in graph.get("nodes", []):
        config = {k: v for k, v in (n.get("config") or {}).items() if v is not None}
        lines.append(
            f"- {n.get('id')} | {n.get('type')} | {n.get('label') or n.get('type')}"
            f" | {json.dumps(config, default=str)}"
        )
    lines.append("EDGES (traffic flows source -> target):")
    for e in graph.get("edges", []):
        lines.append(f"- {e.get('source')} -> {e.get('target')}")
    return "\n".join(lines)


def _serialize_result(result: dict[str, Any]) -> str:
    """Only the fields that carry signal — statuses, per-node metrics for the
    non-healthy nodes, throughput, warnings. Keeps the prompt small at 60 nodes."""
    statuses = result.get("node_statuses") or {}
    metrics = result.get("node_metrics") or {}
    interesting = {
        nid: metrics[nid] for nid, st in statuses.items()
        if st != "healthy" and nid in metrics
    }
    slim = {
        "throughput_requested_rps": result.get("throughput_requested_rps"),
        "throughput_achieved_rps": result.get("throughput_achieved_rps"),
        "critical_path_latency_ms": result.get("critical_path_latency_ms"),
        "node_statuses": statuses,
        "bottlenecks": result.get("bottlenecks") or [],
        "metrics_for_unhealthy_nodes": interesting,
        "warnings": result.get("warnings") or [],
        "tradeoffs": result.get("tradeoffs") or {},
    }
    return json.dumps(slim, default=str)


def _validate(data: Any) -> dict[str, Any]:
    """Shape-check the model output; anything off-contract -> AIUnavailable
    (the route's 503) rather than half-rendered garbage in the UI."""
    if not isinstance(data, dict) or not isinstance(data.get("summary"), str):
        raise AIUnavailable("Model returned an unexpected explanation shape.")
    bottlenecks = []
    for b in data.get("bottlenecks") or []:
        if isinstance(b, dict) and all(isinstance(b.get(k), str) for k in ("why", "fix")):
            bottlenecks.append({
                "node_id": str(b.get("node_id", "")),
                "label": str(b.get("label", "")) or str(b.get("node_id", "")),
                "why": b["why"],
                "fix": b["fix"],
            })
    fixes = [f for f in (data.get("suggested_fixes") or []) if isinstance(f, str) and f]
    return {"summary": data["summary"], "bottlenecks": bottlenecks,
            "suggested_fixes": fixes[:3]}


def explain_simulation(graph: dict[str, Any], result: dict[str, Any]) -> dict[str, Any]:
    """Graph + sim result -> structured explanation (summary / WHYs / fixes)."""
    user = (
        f"ARCHITECTURE:\n{_serialize_graph(graph)}\n\n"
        f"SIMULATION RESULT:\n{_serialize_result(result)}"
    )
    text = generate_json(_SYSTEM, user, max_tokens=_MAX_TOKENS, response_schema=_SCHEMA)
    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        raise AIUnavailable(f"Model returned unparseable JSON: {text[:200]}") from e
    return _validate(data)
