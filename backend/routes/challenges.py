"""Challenges: browse, read, attempt (scored), and review own attempts.

The reference graph never leaves the server — users are scored against it,
not shown it. Attempts work anonymously; they persist only for signed-in users.
"""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.session import get_db
from dependencies import get_current_user, get_current_user_optional
from models.challenge_attempt import ChallengeAttempt
from models.user import User
from services.content import get_challenge, load_challenges
from services.scoring import score_attempt

router = APIRouter(prefix="/challenges", tags=["challenges"])

# Fields safe to expose. The list view stays light; the detail view adds the
# brief the workspace needs. reference_graph and bonus_components stay hidden.
_LIST_FIELDS = ("slug", "title", "description", "difficulty", "tags")
_DETAIL_FIELDS = _LIST_FIELDS + (
    "requirements", "load_rps", "workload", "latency_budget_ms", "hints")


class AttemptRequest(BaseModel):
    graph_json: dict[str, Any]


@router.get("")
def list_challenges():
    return {"challenges": [
        {k: c.get(k) for k in _LIST_FIELDS} for c in load_challenges()
    ]}


@router.get("/{slug}")
def get_challenge_detail(slug: str):
    challenge = get_challenge(slug)
    if challenge is None:
        raise HTTPException(status_code=404, detail="Challenge not found")
    return {k: challenge.get(k) for k in _DETAIL_FIELDS}


@router.get("/{slug}/solution")
def get_solution(slug: str):
    """The reference architecture, for studying AFTER an attempt.

    Deliberately ungated server-side (it's teaching material, not an exam key);
    the frontend only surfaces it once the user has submitted a scored attempt,
    so the learning loop — try first, then compare — stays intact."""
    challenge = get_challenge(slug)
    if challenge is None:
        raise HTTPException(status_code=404, detail="Challenge not found")
    return {
        "reference_graph": challenge["reference_graph"],
        "load_rps": challenge.get("load_rps"),
        "workload": challenge.get("workload"),
        "note": "One good answer — not the only one. Simulate it, poke at it, "
                "then try beating its tradeoff profile with fewer components.",
    }


@router.post("/{slug}/attempt")
def attempt(
    slug: str,
    req: AttemptRequest,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
):
    challenge = get_challenge(slug)
    if challenge is None:
        raise HTTPException(status_code=404, detail="Challenge not found")

    result = score_attempt(req.graph_json, challenge)

    if user is not None:
        db.add(ChallengeAttempt(
            user_id=user.id,
            challenge_id=slug,
            score=result["score"],
            feedback=result["feedback"],
            graph_json=req.graph_json,
        ))
        db.commit()

    return result


@router.get("/{slug}/attempts")
def my_attempts_for(
    slug: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = (
        db.query(ChallengeAttempt)
        .filter(ChallengeAttempt.user_id == user.id,     # app-layer ownership
                ChallengeAttempt.challenge_id == slug)
        .order_by(ChallengeAttempt.created_at.desc())
        .all()
    )
    return {"attempts": [
        {"id": r.id, "score": r.score, "feedback": r.feedback,
         "attempted_at": r.created_at} for r in rows
    ]}
