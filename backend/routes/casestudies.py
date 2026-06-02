"""GET /casestudies, GET /casestudies/{slug} — published case studies only."""
from fastapi import APIRouter

router = APIRouter(prefix="/casestudies", tags=["casestudies"])


@router.get("")
def list_casestudies():
    return {"case_studies": []}  # TODO: Supabase where published = true


@router.get("/{slug}")
def get_casestudy(slug: str):
    return {"case_study": None}  # TODO
