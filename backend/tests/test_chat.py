"""POST /ai/chat, GET /ai/chat/history — the floating global assistant.

No network: generation is monkeypatched with canned text throughout, so
what's under test is our own logic — auth gating, context assembly for all
three modes, persistence, history scoping, and the DB-backed rate limit.
"""
from services import chat as chat_svc


def _mock_generate(monkeypatch, text="A grounded reply.", provider="groq"):
    from services import mentor as mentor_svc
    monkeypatch.setattr(mentor_svc, "retrieve", lambda db, q, **kw: [])
    monkeypatch.setattr(mentor_svc, "_generate", lambda s, u: (text, provider))


def test_chat_requires_auth(client, monkeypatch):
    _mock_generate(monkeypatch)
    r = client.post("/ai/chat", json={"message": "hi"})
    assert r.status_code == 403  # HTTPBearer with no credentials


def test_chat_general_context_persists_both_turns(client, monkeypatch, auth_headers):
    _mock_generate(monkeypatch, text="Sure, here's a general answer.")
    r = client.post("/ai/chat", json={"message": "What is a load balancer?"},
                    headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["answer"] == "Sure, here's a general answer."
    assert body["provider"] == "groq"

    hist = client.get("/ai/chat/history", headers=auth_headers).json()["messages"]
    assert [m["role"] for m in hist[-2:]] == ["user", "assistant"]
    assert hist[-2]["content"] == "What is a load balancer?"
    assert hist[-1]["content"] == "Sure, here's a general answer."
    assert hist[-2]["context_type"] == "general"


def test_chat_case_study_context_scopes_correctly(client, monkeypatch, auth_headers):
    from services import mentor as mentor_svc

    captured = {}
    def fake_generate(system, user):
        captured["user"] = user
        return "About that case study...", "groq"
    monkeypatch.setattr(mentor_svc, "retrieve", lambda db, q, **kw: [])
    monkeypatch.setattr(mentor_svc, "_generate", fake_generate)

    slug = client.get("/casestudies").json()["case_studies"][0]["slug"]
    r = client.post("/ai/chat", json={
        "message": "Why?", "context_type": "case_study", "context_slug": slug,
    }, headers=auth_headers)
    assert r.status_code == 200
    assert "CASE STUDY:" in captured["user"]

    hist = client.get(f"/ai/chat/history?context_type=case_study&context_slug={slug}",
                      headers=auth_headers).json()["messages"]
    assert hist[-1]["context_slug"] == slug


def test_chat_sandbox_context_includes_graph_and_result(client, monkeypatch, auth_headers):
    from services import mentor as mentor_svc

    captured = {}
    def fake_generate(system, user):
        captured["user"] = user
        return "Your app server is the bottleneck.", "groq"
    monkeypatch.setattr(mentor_svc, "retrieve", lambda db, q, **kw: [])
    monkeypatch.setattr(mentor_svc, "_generate", fake_generate)

    graph = {"nodes": [{"id": "a1", "type": "app_server"}], "edges": []}
    result = {"bottlenecks": ["a1"]}
    r = client.post("/ai/chat", json={
        "message": "Why is this slow?", "context_type": "sandbox",
        "graph": graph, "result": result,
    }, headers=auth_headers)
    assert r.status_code == 200
    assert "YOUR CURRENT SANDBOX ARCHITECTURE:" in captured["user"]
    assert "LAST SIMULATION RESULT:" in captured["user"]
    assert "app_server" in captured["user"]


def test_chat_unknown_case_study_404s(client, monkeypatch, auth_headers):
    _mock_generate(monkeypatch)
    r = client.post("/ai/chat", json={
        "message": "Why?", "context_type": "case_study", "context_slug": "nope-not-real",
    }, headers=auth_headers)
    assert r.status_code == 404


def test_chat_history_is_scoped_per_user(client, monkeypatch, auth_headers):
    _mock_generate(monkeypatch)
    client.post("/ai/chat", json={"message": "user A's question"}, headers=auth_headers)

    import uuid
    email = f"user-{uuid.uuid4().hex[:10]}@test.dev"
    res = client.post("/auth/register", json={"email": email, "password": "hunter2secure"})
    other_headers = {"Authorization": f"Bearer {res.json()['access_token']}"}

    hist = client.get("/ai/chat/history", headers=other_headers).json()["messages"]
    assert all("user A's question" != m["content"] for m in hist)


def test_chat_rate_limit_returns_429(client, monkeypatch, auth_headers):
    _mock_generate(monkeypatch)
    monkeypatch.setattr(chat_svc, "RATE_LIMIT_MAX", 2)

    r1 = client.post("/ai/chat", json={"message": "one"}, headers=auth_headers)
    r2 = client.post("/ai/chat", json={"message": "two"}, headers=auth_headers)
    r3 = client.post("/ai/chat", json={"message": "three"}, headers=auth_headers)
    assert r1.status_code == 200 and r2.status_code == 200
    assert r3.status_code == 429
    assert "Retry-After" in r3.headers


def test_chat_message_length_is_bounded(client, monkeypatch, auth_headers):
    _mock_generate(monkeypatch)
    r = client.post("/ai/chat", json={"message": "x" * 3000}, headers=auth_headers)
    assert r.status_code == 422
