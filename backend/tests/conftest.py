"""Shared fixtures. Tests run against a throwaway SQLite file and never
require Postgres, Docker, or an Anthropic key."""
import os
import pathlib

os.environ["DATABASE_URL"] = "sqlite:///./test_systemsim.db"
os.environ.pop("ANTHROPIC_API_KEY", None)  # AI endpoints must 503 in tests

import pytest
from fastapi.testclient import TestClient

_DB_FILE = pathlib.Path("./test_systemsim.db")


@pytest.fixture(scope="session")
def client():
    if _DB_FILE.exists():
        _DB_FILE.unlink()
    from main import app  # import after env override so db.session sees it
    with TestClient(app) as c:  # context manager runs the lifespan (create_all)
        yield c


@pytest.fixture()
def auth_headers(client):
    """Register a fresh user, return their Bearer headers."""
    import uuid
    email = f"user-{uuid.uuid4().hex[:10]}@test.dev"
    res = client.post("/auth/register", json={"email": email, "password": "hunter2secure"})
    assert res.status_code == 201, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}
