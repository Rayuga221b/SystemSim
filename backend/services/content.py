"""Loaders for the JSON-authored content (challenges, case studies).

Content is data, not code (project decision): challenges and case studies
live in backend/data/*.json so they can be edited without redeploying logic.
Files are read once per process and cached — they only change on deploy.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


@lru_cache(maxsize=1)
def load_challenges() -> list[dict[str, Any]]:
    return json.loads((DATA_DIR / "challenges.json").read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def load_case_studies() -> list[dict[str, Any]]:
    return json.loads((DATA_DIR / "case_studies.json").read_text(encoding="utf-8"))


def get_challenge(slug: str) -> dict[str, Any] | None:
    return next((c for c in load_challenges() if c["slug"] == slug), None)


def get_case_study(slug: str) -> dict[str, Any] | None:
    return next((c for c in load_case_studies()
                 if c["slug"] == slug and c.get("published", False)), None)
