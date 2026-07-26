"""API surface: auth, ownership isolation, simulate, challenges, AI fallback."""


SIMPLE_GRAPH = {
    "nodes": [
        {"id": "c1", "type": "client", "config": {}},
        {"id": "a1", "type": "app_server", "config": {"instances": 4}},
        {"id": "d1", "type": "sql_db", "config": {}},
    ],
    "edges": [
        {"id": "e1", "source": "c1", "target": "a1"},
        {"id": "e2", "source": "a1", "target": "d1"},
    ],
}


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


# ------------------------------------------------------------------- auth
def test_register_login_me_roundtrip(client):
    email = "roundtrip@test.dev"
    r = client.post("/auth/register", json={"email": email, "password": "hunter2secure"})
    assert r.status_code == 201
    r = client.post("/auth/register", json={"email": email, "password": "hunter2secure"})
    assert r.status_code == 409  # duplicate email

    r = client.post("/auth/login", json={"email": email, "password": "wrong-password"})
    assert r.status_code == 401
    r = client.post("/auth/login", json={"email": email, "password": "hunter2secure"})
    token = r.json()["access_token"]

    r = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["email"] == email


def test_me_requires_token(client):
    assert client.get("/auth/me").status_code in (401, 403)


# ---------------------------------------------------------------- simulate
def test_simulate_happy_path(client):
    r = client.post("/simulate", json={"graph": SIMPLE_GRAPH, "load_rps": 1000})
    assert r.status_code == 200
    body = r.json()
    assert body["throughput_requested_rps"] == 1000
    assert set(body["node_statuses"]) == {"c1", "a1", "d1"}
    assert "tradeoffs" in body and "node_metrics" in body


def test_simulate_rejects_graph_without_client(client):
    graph = {"nodes": [{"id": "a", "type": "app_server", "config": {}}], "edges": []}
    r = client.post("/simulate", json={"graph": graph, "load_rps": 100})
    assert r.status_code == 422


def test_simulate_rejects_unknown_failure_mode(client):
    r = client.post("/simulate", json={
        "graph": SIMPLE_GRAPH, "load_rps": 100, "failures": {"a1": "gremlins"}})
    assert r.status_code == 422


# ------------------------------------------------------------------ designs
def test_designs_crud_and_ownership_isolation(client, auth_headers):
    created = client.post("/designs", headers=auth_headers, json={
        "title": "My design", "mode": "sandbox", "graph_json": SIMPLE_GRAPH})
    assert created.status_code == 201
    design_id = created.json()["id"]

    listed = client.get("/designs", headers=auth_headers).json()["designs"]
    assert [d["id"] for d in listed] == [design_id]

    updated = client.put(f"/designs/{design_id}", headers=auth_headers,
                         json={"title": "Renamed"})
    assert updated.json()["title"] == "Renamed"

    # Another user cannot see, update, or delete it (404 — not even a 403 leak).
    import uuid
    other = client.post("/auth/register", json={
        "email": f"other-{uuid.uuid4().hex[:8]}@test.dev", "password": "hunter2secure"})
    other_headers = {"Authorization": f"Bearer {other.json()['access_token']}"}
    assert client.get(f"/designs/{design_id}", headers=other_headers).status_code == 404
    assert client.delete(f"/designs/{design_id}", headers=other_headers).status_code == 404
    assert client.get("/designs", headers=other_headers).json()["designs"] == []

    assert client.delete(f"/designs/{design_id}", headers=auth_headers).status_code == 204
    assert client.get(f"/designs/{design_id}", headers=auth_headers).status_code == 404


def test_designs_require_auth(client):
    assert client.get("/designs").status_code in (401, 403)


# --------------------------------------------------------------- challenges
def test_challenge_list_hides_solutions(client):
    challenges = client.get("/challenges").json()["challenges"]
    assert challenges
    for c in challenges:
        assert "reference_graph" not in c
        assert "hints" not in c


def test_challenge_detail_has_brief_but_no_reference_graph(client):
    slug = client.get("/challenges").json()["challenges"][0]["slug"]
    detail = client.get(f"/challenges/{slug}").json()
    assert detail["hints"]
    assert detail["load_rps"] > 0
    assert "reference_graph" not in detail
    assert client.get("/challenges/nope").status_code == 404


def test_solution_endpoint_returns_reference_graph(client):
    slug = client.get("/challenges").json()["challenges"][0]["slug"]
    r = client.get(f"/challenges/{slug}/solution")
    assert r.status_code == 200
    body = r.json()
    assert body["reference_graph"]["nodes"]
    assert body["load_rps"] > 0
    assert client.get("/challenges/nope/solution").status_code == 404


def test_anonymous_attempt_scores_without_persisting(client):
    slug = client.get("/challenges").json()["challenges"][0]["slug"]
    r = client.post(f"/challenges/{slug}/attempt", json={"graph_json": SIMPLE_GRAPH})
    assert r.status_code == 200
    body = r.json()
    assert 0 <= body["score"] <= 100
    assert set(body["feedback"]) == {"missing", "weak", "good"}


def test_authed_attempt_persists_and_shows_in_history(client, auth_headers):
    slug = client.get("/challenges").json()["challenges"][0]["slug"]
    r = client.post(f"/challenges/{slug}/attempt", headers=auth_headers,
                    json={"graph_json": SIMPLE_GRAPH})
    score = r.json()["score"]

    per_challenge = client.get(f"/challenges/{slug}/attempts",
                               headers=auth_headers).json()["attempts"]
    assert len(per_challenge) == 1 and per_challenge[0]["score"] == score

    mine = client.get("/me/attempts", headers=auth_headers).json()["attempts"]
    assert len(mine) == 1
    assert mine[0]["challenge_slug"] == slug
    assert mine[0]["challenge_title"]  # resolved from content


# ------------------------------------------------------------- case studies
def test_case_studies_list_and_detail(client):
    studies = client.get("/casestudies").json()["case_studies"]
    assert studies
    slug = studies[0]["slug"]
    detail = client.get(f"/casestudies/{slug}").json()
    assert detail["starter_graph"]["nodes"]
    assert client.get("/casestudies/nope").status_code == 404


# --------------------------------------------------------------------- ai
# The explainer runs on Groq (services/ai_explain.py), the mentor on Claude.
# Tests never touch either provider: keys are stripped via monkeypatch (503
# path) and the Groq call is mocked (success path) — robust regardless of
# what .env contains.

def test_ai_explain_returns_503_without_groq_key(client, monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    r = client.post("/ai/explain", json={"graph": SIMPLE_GRAPH, "result": {}})
    assert r.status_code == 503


def test_ai_mentor_returns_503_without_anthropic_key(client, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    slug = client.get("/casestudies").json()["case_studies"][0]["slug"]
    r = client.post("/ai/mentor", json={"case_study_slug": slug, "question": "Why?"})
    assert r.status_code == 503


def test_ai_explain_returns_structured_explanation(client, monkeypatch):
    import json
    from services import ai_explain

    fake = {
        "summary": "Your app server saturates first.",
        "bottlenecks": [
            {"node_id": "a1", "label": "App Server", "why": "4 instances cap out.",
             "fix": "Scale to 8 instances."},
        ],
        "suggested_fixes": ["Add a cache in front of the database."],
    }
    captured = {}

    def fake_generate_json(system, user, **kwargs):
        captured["system"] = system
        captured["user"] = user
        captured["schema"] = kwargs.get("response_schema")
        return json.dumps(fake)

    monkeypatch.setattr(ai_explain, "generate_json", fake_generate_json)

    result = {
        "node_statuses": {"c1": "healthy", "a1": "overloaded", "d1": "healthy"},
        "bottlenecks": ["a1"],
        "node_metrics": {"a1": {"in_rps": 1000, "capacity_rps": 400,
                                "utilization_pct": 250, "latency_ms": 20}},
        "throughput_requested_rps": 1000,
        "throughput_achieved_rps": 400,
        "critical_path_latency_ms": 60,
        "warnings": [],
        "tradeoffs": {},
    }
    r = client.post("/ai/explain", json={"graph": SIMPLE_GRAPH, "result": result})
    assert r.status_code == 200
    body = r.json()
    assert body["summary"] == fake["summary"]
    assert body["bottlenecks"][0]["node_id"] == "a1"
    assert body["bottlenecks"][0]["why"] and body["bottlenecks"][0]["fix"]
    assert body["suggested_fixes"] == fake["suggested_fixes"]
    # Prompt is context-scoped: the concrete graph and result are in it.
    assert "a1 | app_server" in captured["user"]
    assert "overloaded" in captured["user"]
    assert captured["schema"] is not None  # controlled generation, not free text


def test_ai_explain_returns_503_on_malformed_model_output(client, monkeypatch):
    from services import ai_explain

    monkeypatch.setattr(ai_explain, "generate_json", lambda *a, **k: "not json {")
    r = client.post("/ai/explain", json={"graph": SIMPLE_GRAPH, "result": {}})
    assert r.status_code == 503
