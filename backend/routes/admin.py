"""POST /admin/ingest — case study ingestion pipeline (admin only).

Fetch seed URL -> Claude extracts structured JSON -> store unpublished.
"""
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/admin", tags=["admin"])


class IngestRequest(BaseModel):
    url: str


@router.post("/ingest")
def ingest(req: IngestRequest):
    # TODO: services/ingest.py -> fetch(url) -> claude_extract() -> supabase insert
    #   leaves published=false; starter_graph set manually before publishing.
    return {"ingested": False, "case_study_id": None}
