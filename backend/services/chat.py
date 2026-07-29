"""services/chat.py — the floating global AI assistant.

Persistence + rate limiting layered on top of services/mentor.py's grounded
generation core (`respond()`). This is what POST /ai/chat calls.

WHY auth-gated (DECISION 2026-07-29, docs/RAG.md): the floating widget is
enabled ONLY for signed-in users — routes/ai.py requires get_current_user, no
optional-anonymous path. Two reasons, one of them load-bearing:

1. Persistence needs an owner — messages are stored per-user (AiMessage.user_id)
   so the widget can show your own history back to you.
2. Rate limiting needs an identity to count against. This is the answer to
   "will also help with rate limiting" — auth-gating doesn't rate-limit by
   itself, but it's the PRECONDITION for the DB-backed limiter below: you
   cannot cap "20 messages per 10 minutes" against something you can't
   attribute requests to. An anonymous /ai/chat would only be cappable by IP
   (spoofable, punishes shared networks) or not at all.

RATE LIMIT DESIGN: a plain count query over ai_messages, no Redis. Same
reasoning as "no vector DB" in docs/RAG.md — at this scale (one process, a
handful of concurrent users) a SELECT COUNT with an index on (user_id,
created_at) is fast and needs zero new infrastructure. The documented upgrade
path if this ever shows up in a profile: a sliding-window counter in Redis,
same interface (_check_rate_limit swaps internals, callers don't change).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from models.ai_message import AiMessage
from models.user import User
from services import mentor
from services import roadmap as roadmap_svc
from services.content import get_case_study

RATE_LIMIT_MAX = 20
RATE_LIMIT_WINDOW_MINUTES = 10

AIUnavailable = mentor.AIUnavailable  # re-exported so routes only import chat


class RateLimited(Exception):
    def __init__(self, retry_after_s: int):
        self.retry_after_s = retry_after_s
        super().__init__(f"Chat rate limit reached — try again in {retry_after_s}s")


class CaseStudyNotFound(Exception):
    pass


class RoadmapLessonNotFound(Exception):
    pass


def _check_rate_limit(db: Session, user_id: str) -> None:
    since = datetime.now(timezone.utc) - timedelta(minutes=RATE_LIMIT_WINDOW_MINUTES)
    count = db.execute(
        select(func.count(AiMessage.id)).where(
            AiMessage.user_id == user_id,
            AiMessage.role == "user",
            AiMessage.created_at >= since,
        )
    ).scalar_one()
    if count < RATE_LIMIT_MAX:
        return
    oldest = db.execute(
        select(func.min(AiMessage.created_at)).where(
            AiMessage.user_id == user_id,
            AiMessage.role == "user",
            AiMessage.created_at >= since,
        )
    ).scalar_one()
    # SQLite has no native tz-aware column type — SQLAlchemy emulates
    # DateTime(timezone=True) on write but hands back a naive datetime on
    # read, even though it was stored as UTC. Postgres round-trips tzinfo
    # correctly; normalize here so this works identically on both.
    if oldest.tzinfo is None:
        oldest = oldest.replace(tzinfo=timezone.utc)
    retry_after = int((oldest + timedelta(minutes=RATE_LIMIT_WINDOW_MINUTES)
                       - datetime.now(timezone.utc)).total_seconds())
    raise RateLimited(max(retry_after, 1))


def send(db: Session, user: User, *, message: str, context_type: str = "general",
         context_slug: str | None = None, graph: dict[str, Any] | None = None,
         result: dict[str, Any] | None = None) -> dict[str, Any]:
    """Persist the user's turn, generate a grounded reply, persist that too.

    The user's message is committed BEFORE generation and stays committed even
    if generation then raises — an unanswered question in your history is
    honest; silently discarding what you asked is not.
    """
    _check_rate_limit(db, user.id)

    case_study = None
    roadmap_lesson = None
    if context_type == "case_study":
        if not context_slug:
            raise ValueError("context_slug is required when context_type is 'case_study'")
        case_study = get_case_study(context_slug)
        if case_study is None:
            raise CaseStudyNotFound(context_slug)
    elif context_type == "roadmap":
        if not context_slug:
            raise ValueError("context_slug is required when context_type is 'roadmap'")
        roadmap_lesson = roadmap_svc.get_lesson(db, context_slug)
        if roadmap_lesson is None:
            raise RoadmapLessonNotFound(context_slug)

    sandbox = {"graph": graph, "result": result} if context_type == "sandbox" else None
    exclude_slug = case_study["slug"] if case_study else (
        roadmap_lesson["slug"] if roadmap_lesson else None
    )

    db.add(AiMessage(user_id=user.id, role="user", content=message,
                     context_type=context_type, context_slug=context_slug))
    db.commit()

    out = mentor.respond(db, message, case_study=case_study, sandbox=sandbox,
                         roadmap=roadmap_lesson, exclude_slug=exclude_slug)

    db.add(AiMessage(user_id=user.id, role="assistant", content=out["answer"],
                     context_type=context_type, context_slug=context_slug,
                     sources=out["sources"], grounded=out["grounded"]))
    db.commit()
    return out


def history(db: Session, user: User, *, context_type: str | None = None,
            context_slug: str | None = None, limit: int = 50) -> list[AiMessage]:
    q = select(AiMessage).where(AiMessage.user_id == user.id)
    if context_type:
        q = q.where(AiMessage.context_type == context_type)
    if context_slug:
        q = q.where(AiMessage.context_slug == context_slug)
    rows = db.execute(q.order_by(AiMessage.created_at.desc()).limit(limit)).scalars().all()
    return list(reversed(rows))
