"""POST /simulate — run a load simulation over a system graph.

Thin route: Pydantic validates shape (≥1 client, ≤60 nodes, positive load),
the engine does everything else. Engine ValueErrors become 422s so the
frontend always gets an actionable message.
"""
from fastapi import APIRouter, HTTPException

from engine.simulation import SimulationEngine
from schemas.simulate import SimulateRequest, SimulateResponse

router = APIRouter(prefix="/simulate", tags=["simulate"])


@router.post("", response_model=SimulateResponse)
def simulate(req: SimulateRequest) -> SimulateResponse:
    try:
        engine = SimulationEngine(req.graph.model_dump())
        result = engine.run(
            load_rps=req.load_rps,
            failures=req.failures,
            read_pct=req.workload.read_pct,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return SimulateResponse(**result)
