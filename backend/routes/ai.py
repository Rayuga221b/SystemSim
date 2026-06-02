"""POST /ai/explain, POST /ai/mentor — context-scoped Claude calls.

Both endpoints ALWAYS include concrete context (graph state or case-study text)
in the prompt. No open-ended chat.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Any

router = APIRouter(prefix="/ai", tags=["ai"])


class ExplainRequest(BaseModel):
    graph: dict[str, Any]
    result: dict[str, Any]  # the simulation output


class MentorRequest(BaseModel):
    case_study_slug: str
    question: str


@router.post("/explain")
def explain(req: ExplainRequest):
    # TODO: services/claude.py -> build prompt from graph+result, stream back.
    return {"explanation": ""}


@router.post("/mentor")
def mentor(req: MentorRequest):
    # TODO: load case study, scope prompt to it + req.question, stream back.
    return {"answer": ""}
