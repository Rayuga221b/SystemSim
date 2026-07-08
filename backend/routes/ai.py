"""POST /ai/explain, POST /ai/mentor — context-scoped Claude calls.

Both endpoints ALWAYS include concrete context (graph state or case-study
text) in the prompt. No open-ended chat. 503 when no API key is configured.
"""
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.claude import AIUnavailable, case_study_mentor, explain_simulation
from services.content import get_case_study

router = APIRouter(prefix="/ai", tags=["ai"])


class ExplainRequest(BaseModel):
    graph: dict[str, Any]
    result: dict[str, Any]  # the simulation output


class MentorRequest(BaseModel):
    case_study_slug: str
    question: str


@router.post("/explain")
def explain(req: ExplainRequest):
    try:
        return {"answer": explain_simulation(req.graph, req.result)}
    except AIUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/mentor")
def mentor(req: MentorRequest):
    cs = get_case_study(req.case_study_slug)
    if cs is None:
        raise HTTPException(status_code=404, detail="Case study not found")
    try:
        return {"answer": case_study_mentor(cs, req.question)}
    except AIUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e))
