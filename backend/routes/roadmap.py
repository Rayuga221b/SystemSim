"""Roadmap: the long-form System Design learning track.

List view returns module-grouped lesson cards for the sidebar/overview; detail
returns one full lesson plus prev/next for the reader. Published lessons only.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.session import get_db
from services import roadmap as roadmap_svc

router = APIRouter(prefix="/roadmap", tags=["roadmap"])


@router.get("")
def get_overview(db: Session = Depends(get_db)):
    return roadmap_svc.overview(db)


@router.get("/{slug}")
def get_lesson(slug: str, db: Session = Depends(get_db)):
    lesson = roadmap_svc.get_lesson(db, slug)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return lesson
