"""CRUD /designs — user-saved canvases.

Every route requires auth and every query filters by the resolved user_id:
ownership lives in the app layer now (no RLS backstop), so the filter is the
security boundary. See CLAUDE.md "Ownership enforced in the app layer".
"""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from db.session import get_db
from dependencies import get_current_user
from models.design import Design
from models.user import User

router = APIRouter(prefix="/designs", tags=["designs"])

VALID_MODES = {"sandbox", "challenge", "casestudy"}


class DesignIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    mode: str = "sandbox"
    graph_json: dict[str, Any]


class DesignPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    mode: str | None = None
    graph_json: dict[str, Any] | None = None


def _own(db: Session, user_id: str, design_id: str) -> Design:
    """Fetch a design scoped to its owner; 404 either way (no existence leak)."""
    design = (db.query(Design)
              .filter(Design.id == design_id, Design.user_id == user_id)
              .first())
    if design is None:
        raise HTTPException(status_code=404, detail="Design not found")
    return design


def _shape(d: Design) -> dict[str, Any]:
    return {"id": d.id, "title": d.title, "mode": d.mode,
            "graph_json": d.graph_json,
            "created_at": d.created_at, "updated_at": d.updated_at}


@router.get("")
def list_designs(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (db.query(Design)
            .filter(Design.user_id == user.id)
            .order_by(Design.updated_at.desc())
            .all())
    return {"designs": [_shape(d) for d in rows]}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_design(body: DesignIn, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    if body.mode not in VALID_MODES:
        raise HTTPException(status_code=422, detail=f"mode must be one of {sorted(VALID_MODES)}")
    design = Design(user_id=user.id, title=body.title, mode=body.mode,
                    graph_json=body.graph_json)
    db.add(design)
    db.commit()
    db.refresh(design)
    return _shape(design)


@router.get("/{design_id}")
def get_design(design_id: str, db: Session = Depends(get_db),
               user: User = Depends(get_current_user)):
    return _shape(_own(db, user.id, design_id))


@router.put("/{design_id}")
def update_design(design_id: str, body: DesignPatch, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    design = _own(db, user.id, design_id)
    if body.mode is not None and body.mode not in VALID_MODES:
        raise HTTPException(status_code=422, detail=f"mode must be one of {sorted(VALID_MODES)}")
    if body.title is not None:
        design.title = body.title
    if body.mode is not None:
        design.mode = body.mode
    if body.graph_json is not None:
        design.graph_json = body.graph_json
    db.commit()
    db.refresh(design)
    return _shape(design)


@router.delete("/{design_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_design(design_id: str, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    db.delete(_own(db, user.id, design_id))
    db.commit()
