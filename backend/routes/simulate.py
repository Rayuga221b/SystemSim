"""POST /simulate — run a load simulation over a system graph.

Thin route: validate input, hand to the SimulationEngine, return its result.
The engine itself is written by hand (see engine/simulation.py).
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any

router = APIRouter(prefix="/simulate", tags=["simulate"])


class SimulateRequest(BaseModel):
    graph: dict[str, Any]  # { nodes: [...], edges: [...] }
    load_rps: int
    failures: dict[str, str] | None = None  # node_id -> failure_mode


@router.post("")
def simulate(req: SimulateRequest):
    # TODO(Satyam): instantiate SimulationEngine(req.graph) and run.
    #   from engine.simulation import SimulationEngine
    #   return SimulationEngine(req.graph).run(req.load_rps, req.failures)
    raise HTTPException(status_code=501, detail="Simulation engine not yet implemented")
