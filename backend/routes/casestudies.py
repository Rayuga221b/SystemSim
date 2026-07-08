"""Case studies: curated JSON content, published entries only.

List view returns card summaries; detail returns the full study including the
starter graph for "Simulate This"."""
from fastapi import APIRouter, HTTPException

from services.content import get_case_study, load_case_studies

router = APIRouter(prefix="/casestudies", tags=["casestudies"])

_LIST_FIELDS = ("slug", "company", "title", "one_liner", "difficulty", "tags")


@router.get("")
def list_casestudies():
    return {"case_studies": [
        {k: cs.get(k) for k in _LIST_FIELDS}
        for cs in load_case_studies() if cs.get("published", False)
    ]}


@router.get("/{slug}")
def get_casestudy(slug: str):
    cs = get_case_study(slug)
    if cs is None:
        raise HTTPException(status_code=404, detail="Case study not found")
    return cs
