"""Pydantic models for /simulate — mirrors docs/spec.md plus node_metrics."""
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

MAX_NODES = 60


class GraphNode(BaseModel):
    id: str
    type: str
    label: str | None = None
    config: dict[str, Any] = Field(default_factory=dict)


class GraphEdge(BaseModel):
    id: str | None = None
    source: str
    target: str


class Graph(BaseModel):
    nodes: list[GraphNode] = Field(default_factory=list)
    edges: list[GraphEdge] = Field(default_factory=list)


class Workload(BaseModel):
    """Read/write mix. read_pct=80 means 80% of load_rps are reads."""
    read_pct: float = Field(default=80, ge=0, le=100)


class SimulateRequest(BaseModel):
    graph: Graph
    load_rps: int = Field(gt=0, le=10_000_000)
    workload: Workload = Field(default_factory=Workload)
    failures: dict[str, str] | None = None  # node_id -> failure mode

    @field_validator("graph")
    @classmethod
    def graph_shape(cls, g: Graph) -> Graph:
        if not any(n.type == "client" for n in g.nodes):
            raise ValueError("graph must contain at least one client node")
        if len(g.nodes) > MAX_NODES:
            raise ValueError(f"graph exceeds {MAX_NODES} nodes")
        return g


class NodeMetrics(BaseModel):
    in_rps: float
    out_rps: float
    capacity_rps: float  # 0 means unlimited
    utilization_pct: float
    latency_ms: float


class Tradeoffs(BaseModel):
    consistency: int
    availability: int
    scalability: int
    latency: int
    cost: Literal["low", "medium", "high"]
    complexity: Literal["low", "medium", "high"]


class SimulateResponse(BaseModel):
    node_statuses: dict[str, Literal["healthy", "warning", "overloaded", "failed"]]
    node_metrics: dict[str, NodeMetrics]
    critical_path_latency_ms: float
    bottlenecks: list[str]
    throughput_achieved_rps: float
    throughput_requested_rps: float
    tradeoffs: Tradeoffs
    warnings: list[str]
