"""Content validation + scoring rubric.

The content tests are the editorial safety net: every challenge's reference
graph must actually pass its own challenge, and every case-study starter graph
must at least simulate (they are ALLOWED to be overloaded — reproducing the
incident is their job).
"""
import pytest

from engine.simulation import SimulationEngine
from services.content import load_case_studies, load_challenges
from services.scoring import score_attempt

CHALLENGE_REQUIRED_KEYS = {
    "slug", "title", "description", "requirements", "difficulty", "tags",
    "load_rps", "workload", "required_components", "reference_graph", "hints",
}
CASE_STUDY_REQUIRED_KEYS = {
    "slug", "company", "title", "one_liner", "difficulty", "tags", "published",
    "problem", "solution", "scale_context", "lessons", "components",
    "starter_graph", "starter_load_rps", "simulate_prompt",
}


def test_challenges_have_required_fields():
    challenges = load_challenges()
    assert len(challenges) >= 6
    for c in challenges:
        missing = CHALLENGE_REQUIRED_KEYS - set(c)
        assert not missing, f"{c.get('slug')} missing {missing}"


@pytest.mark.parametrize("challenge", load_challenges(), ids=lambda c: c["slug"])
def test_reference_graph_survives_its_own_load(challenge):
    engine = SimulationEngine(challenge["reference_graph"])
    result = engine.run(load_rps=challenge["load_rps"],
                        read_pct=challenge["workload"]["read_pct"])
    hot = [nid for nid, s in result["node_statuses"].items()
           if s in ("overloaded", "failed")]
    assert not hot, f"reference graph has overloaded nodes: {hot}"
    assert result["throughput_achieved_rps"] == pytest.approx(
        result["throughput_requested_rps"], rel=0.01)


@pytest.mark.parametrize("challenge", load_challenges(), ids=lambda c: c["slug"])
def test_reference_graph_scores_high(challenge):
    result = score_attempt(challenge["reference_graph"], challenge)
    assert result["score"] >= 80, (
        f"reference solution only scores {result['score']}: {result['feedback']}")


def test_empty_graph_scores_low_with_missing_feedback():
    challenge = load_challenges()[0]
    result = score_attempt({"nodes": [], "edges": []}, challenge)
    assert result["score"] <= 40
    assert result["feedback"]["missing"]


def test_disconnected_components_earn_no_performance_points():
    """The right shopping list with zero wiring must not score like a design."""
    challenge = load_challenges()[0]
    nodes = [{"id": f"n{i}", "type": t, "config": {}}
             for i, t in enumerate(["client"] + challenge["required_components"])]
    result = score_attempt({"nodes": nodes, "edges": []}, challenge)
    assert result["score"] <= 55, result
    assert any("never leaves" in w for w in result["feedback"]["weak"])


def test_case_studies_have_required_fields_and_simulate():
    studies = load_case_studies()
    assert len(studies) >= 5
    for cs in studies:
        missing = CASE_STUDY_REQUIRED_KEYS - set(cs)
        assert not missing, f"{cs.get('slug')} missing {missing}"
        # The starter graph must load and run — being overloaded is fine.
        engine = SimulationEngine(cs["starter_graph"])
        result = engine.run(load_rps=cs["starter_load_rps"])
        assert result["throughput_requested_rps"] > 0
