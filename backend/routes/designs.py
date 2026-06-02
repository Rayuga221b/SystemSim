"""CRUD /designs — user-saved canvases (Supabase, RLS scoped to owner)."""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Any

router = APIRouter(prefix="/designs", tags=["designs"])


class DesignIn(BaseModel):
    title: str
    mode: str  # 'sandbox' | 'challenge' | 'casestudy'
    graph_json: dict[str, Any]


@router.get("")
def list_designs():
    return {"designs": []}  # TODO: Supabase select scoped to user


@router.post("")
def create_design(body: DesignIn):
    return {"id": None}  # TODO: Supabase insert


@router.get("/{design_id}")
def get_design(design_id: str):
    return {"design": None}  # TODO


@router.put("/{design_id}")
def update_design(design_id: str, body: DesignIn):
    return {"updated": False}  # TODO


@router.delete("/{design_id}")
def delete_design(design_id: str):
    return {"deleted": False}  # TODO
