"""POST /ai/explain, POST /ai/mentor, POST /ai/chat — context-scoped AI calls.

Every endpoint ALWAYS includes concrete context (graph state, case-study
text, roadmap-lesson text, or platform passages) in the prompt. 503 when no
provider is configured. Providers (see CLAUDE.md Decisions): /ai/explain runs
on Groq (services/ai_explain.py). /ai/mentor and /ai/chat share the
RAG-grounded core in services/mentor.py: retrieval over the platform corpus +
a Claude→Groq generation chain, with citations filtered to what the answer
actually used (DECISION 2026-07-29, docs/RAG.md).

/ai/mentor is public (no auth) — it backs two per-document widgets: the
case-study mentor (`case_study_slug`) and the roadmap-lesson mentor
(`roadmap_slug`), mutually exclusive.

/ai/chat is the floating global assistant (services/chat.py) — auth-required,
persisted per-user, and DB-rate-limited (the auth requirement is what makes
the rate limit possible: see services/chat.py docstring). Its context_type
now also accepts "roadmap" (DECISION 2026-07-30) so the global assistant's
own thread is scoped per-lesson, same as case studies.
"""
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session

from db.session import get_db
from dependencies import get_current_user
from models.user import User
from services import ai_explain, chat as chat_svc, mentor as mentor_svc
from services import roadmap as roadmap_svc
from services.content import get_case_study
from services.groq import AIUnavailable as GroqUnavailable

router = APIRouter(prefix="/ai", tags=["ai"])


class ExplainRequest(BaseModel):
    graph: dict[str, Any]
    result: dict[str, Any]  # the simulation output


class MentorRequest(BaseModel):
    case_study_slug: str | None = None
    roadmap_slug: str | None = None
    question: str

    @model_validator(mode="after")
    def _exactly_one_slug(self):
        if bool(self.case_study_slug) == bool(self.roadmap_slug):
            raise ValueError("Provide exactly one of case_study_slug or roadmap_slug")
        return self


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    context_type: Literal["case_study", "sandbox", "roadmap", "general"] = "general"
    context_slug: str | None = None          # required when context_type == "case_study" | "roadmap"
    graph: dict[str, Any] | None = None       # used when context_type == "sandbox"
    result: dict[str, Any] | None = None      # used when context_type == "sandbox"


@router.post("/explain")
def explain(req: ExplainRequest):
    try:
        return ai_explain.explain_simulation(req.graph, req.result)
    except GroqUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/mentor")
def mentor(req: MentorRequest, db: Session = Depends(get_db)):
    try:
        if req.case_study_slug:
            cs = get_case_study(req.case_study_slug)
            if cs is None:
                raise HTTPException(status_code=404, detail="Case study not found")
            return mentor_svc.answer(db, cs, req.question)

        lesson = roadmap_svc.get_lesson(db, req.roadmap_slug)
        if lesson is None:
            raise HTTPException(status_code=404, detail="Lesson not found")
        return mentor_svc.answer_roadmap(db, lesson, req.question)
    except mentor_svc.AIUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/chat")
def chat(req: ChatRequest, db: Session = Depends(get_db),
         user: User = Depends(get_current_user)):
    try:
        return chat_svc.send(
            db, user, message=req.message, context_type=req.context_type,
            context_slug=req.context_slug, graph=req.graph, result=req.result,
        )
    except chat_svc.CaseStudyNotFound:
        raise HTTPException(status_code=404, detail="Case study not found")
    except chat_svc.RoadmapLessonNotFound:
        raise HTTPException(status_code=404, detail="Lesson not found")
    except chat_svc.RateLimited as e:
        raise HTTPException(status_code=429, detail=str(e),
                            headers={"Retry-After": str(e.retry_after_s)})
    except chat_svc.AIUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/chat/history")
def chat_history(context_type: str | None = None, context_slug: str | None = None,
                  db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = chat_svc.history(db, user, context_type=context_type, context_slug=context_slug)
    return {"messages": [
        {
            "id": r.id, "role": r.role, "content": r.content,
            "context_type": r.context_type, "context_slug": r.context_slug,
            "sources": r.sources, "grounded": r.grounded, "created_at": r.created_at,
        }
        for r in rows
    ]}
