"""GET /me/attempts — the caller's challenge attempt history (dashboard)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db.session import get_db
from dependencies import get_current_user
from models.challenge_attempt import ChallengeAttempt
from models.user import User
from services.content import get_challenge

router = APIRouter(prefix="/me", tags=["me"])


@router.get("/attempts")
def my_attempts(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (
        db.query(ChallengeAttempt)
        .filter(ChallengeAttempt.user_id == user.id)   # app-layer ownership
        .order_by(ChallengeAttempt.created_at.desc())
        .all()
    )
    return {"attempts": [
        {
            "id": r.id,
            "challenge_slug": r.challenge_id,
            "challenge_title": (get_challenge(r.challenge_id) or {}).get("title", r.challenge_id),
            "score": r.score,
            "feedback": r.feedback,
            "attempted_at": r.created_at,
        }
        for r in rows
    ]}
