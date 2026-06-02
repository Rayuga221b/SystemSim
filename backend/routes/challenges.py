"""GET /challenges, POST /challenges/{id}/attempt."""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Any

router = APIRouter(prefix="/challenges", tags=["challenges"])


class AttemptRequest(BaseModel):
    user_id: str | None = None
    graph_json: dict[str, Any]


@router.get("")
def list_challenges():
    # TODO: load from data/challenges.json (or Supabase) and return list.
    return {"challenges": []}


@router.post("/{challenge_id}/attempt")
def attempt(challenge_id: str, req: AttemptRequest):
    # TODO: score req.graph_json against the challenge reference_graph.
    #   scoring logic lives in services/scoring.py
    return {"score": 0, "feedback": {"missing": [], "weak": [], "good": []}}
