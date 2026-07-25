"""POST /ai/explain, POST /ai/mentor — context-scoped AI calls.

Both endpoints ALWAYS include concrete context (graph state or case-study
text) in the prompt. No open-ended chat. 503 when no API key is configured.

Providers are split on purpose (see CLAUDE.md Decisions, 2026-07-25):
/ai/explain runs on Gemini (services/ai_explain.py — the key we have),
/ai/mentor stays on Claude (services/claude.py). Each raises its own
AIUnavailable; the route maps both to the same 503 contract.
"""
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services import ai_explain
from services.claude import AIUnavailable as ClaudeUnavailable
from services.claude import case_study_mentor
from services.content import get_case_study
from services.gemini import AIUnavailable as GeminiUnavailable

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
        return ai_explain.explain_simulation(req.graph, req.result)
    except GeminiUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/mentor")
def mentor(req: MentorRequest):
    cs = get_case_study(req.case_study_slug)
    if cs is None:
        raise HTTPException(status_code=404, detail="Case study not found")
    try:
        return {"answer": case_study_mentor(cs, req.question)}
    except ClaudeUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e))
