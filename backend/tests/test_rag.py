"""RAG layer tests — chunking, retrieval, and the mentor contract.

No network anywhere: embeddings are monkeypatched with tiny hand-built
vectors, generation with canned text. What's actually under test is our own
logic — chunk boundaries, ranking, diversity caps, the degradation contract,
and the response envelope the frontend depends on.
"""
import numpy as np
import pytest

from services import rag
from services.rag import Chunk, chunk_case_study, chunk_markdown, retrieve


# ── chunking ─────────────────────────────────────────────────────────────────

LESSON_MD = """Intro paragraph long enough to survive the fragment filter, padded
with more words so it clears the minimum comfortably for the test.

## Cache invalidation

Body of the first real section. It explains things at length so that the
chunk is meaningful and comfortably above the minimum size threshold.

## Consistent hashing

Second section body, also long enough to be kept as its own chunk after the
splitter runs over the document text.
"""


def test_chunker_splits_on_h2_and_keeps_intro():
    chunks = chunk_markdown("roadmap", "day-1-x", "Day 1: Caching", LESSON_MD)
    assert [c.heading for c in chunks] == [None, "Cache invalidation", "Consistent hashing"]
    # Anchors mirror the frontend heading-id slugify → citations deep-link.
    assert chunks[1].anchor == "cache-invalidation"
    # Embed text is context-prefixed; stored content is the raw passage.
    assert chunks[1].embed_text.startswith("Day 1: Caching — Cache invalidation")
    assert "first real section" in chunks[1].content


def test_chunker_splits_oversized_sections_with_overlap():
    para = "One meaningful paragraph of filler text for the splitter. " * 8
    big = "## Big topic\n\n" + "\n\n".join(f"P{i}. {para}" for i in range(8))
    chunks = chunk_markdown("roadmap", "s", "T", big)
    assert len(chunks) > 1
    assert all(c.heading == "Big topic" for c in chunks)
    # Overlap: the last paragraph of chunk N reappears at the start of N+1.
    tail = chunks[0].content.split("\n\n")[-1]
    assert chunks[1].content.startswith(tail)


def test_chunker_never_cuts_inside_a_code_fence():
    fenced = "```python\nline1\n\n\nline2\n```"
    md = f"## Code\n\nIntro paragraph that is long enough to matter here.\n\n{fenced}\n\nOutro paragraph, also long enough to be kept around."
    chunks = chunk_markdown("roadmap", "s", "T", md)
    joined = "\n".join(c.content for c in chunks)
    assert fenced in joined  # fence survived intact, blank lines and all


def test_chunker_excludes_the_sandbox_cta_boilerplate():
    md = (
        "## Real content\n\nA real technical section, long enough to survive "
        "the minimum-length filter comfortably in this test.\n\n"
        "## Try it in the sandbox\n\nBuild this yourself in the SystemSim "
        "sandbox and see what happens when you add more nodes to the cluster."
    )
    chunks = chunk_markdown("roadmap", "s", "T", md)
    assert [c.heading for c in chunks] == ["Real content"]

    # Case variant used by some lessons ("...in the Sandbox") is also caught.
    md2 = md.replace("Try it in the sandbox", "Try it in the Sandbox")
    chunks2 = chunk_markdown("roadmap", "s", "T", md2)
    assert [c.heading for c in chunks2] == ["Real content"]


def test_case_study_chunks_carry_section_anchors():
    cs = {
        "slug": "discord-x", "company": "Discord", "title": "Trillions",
        "problem": "Hot partitions concentrated read and write pressure badly. " * 4,
        "solution": "They migrated to a C++ store and added request coalescing. " * 4,
        "lessons": ["Shard by access pattern, not just by key." * 3],
        "published": True,
    }
    chunks = chunk_case_study(cs)
    anchors = {c.anchor for c in chunks}
    assert anchors == {"problem", "solution", "lessons"}
    assert all(c.source_title == "Discord: Trillions" for c in chunks)


# ── retrieval ────────────────────────────────────────────────────────────────

def _seed_index(client, monkeypatch, vectors):
    """Insert rag_chunks rows with tiny fake embeddings via the app's session."""
    from db.session import SessionLocal
    from models.rag_chunk import RagChunk
    from services import embeddings as emb

    monkeypatch.setattr(rag, "EMBEDDING_MODEL", "fake-embed")
    db = SessionLocal()
    db.query(RagChunk).delete()
    for i, (slug, vec) in enumerate(vectors):
        db.add(RagChunk(
            source_type="roadmap", source_slug=slug, source_title=f"T {slug}",
            heading="H", anchor="h", chunk_index=i, content=f"content {i}",
            content_hash=f"h{i}", embedding=vec, embedding_model="fake-embed",
        ))
    db.commit()
    db.close()
    rag._cache["fp"] = None  # drop any cached matrix from other tests


def test_retrieve_ranks_by_cosine_and_caps_per_source(client, monkeypatch):
    _seed_index(client, monkeypatch, [
        ("doc-a", [1.0, 0.0, 0.0]),   # exact hit
        ("doc-a", [0.9, 0.1, 0.0]),   # close
        ("doc-a", [0.8, 0.2, 0.0]),   # close but doc-a already has 2 in
        ("doc-b", [0.6, 0.4, 0.0]),   # different source
        ("doc-c", [0.0, 0.0, 1.0]),   # orthogonal → below MIN_SCORE
    ])
    monkeypatch.setattr(rag, "embed_query", lambda q: [1.0, 0.0, 0.0])

    from db.session import SessionLocal
    db = SessionLocal()
    hits = retrieve(db, "anything")
    db.close()

    slugs = [h.source_slug for h in hits]
    assert slugs.count("doc-a") == 2          # PER_SOURCE_CAP enforced
    assert "doc-b" in slugs                   # diversity slot went to doc-b
    assert "doc-c" not in slugs               # under the score floor
    assert hits == sorted(hits, key=lambda h: -h.score)


def test_retrieve_excludes_current_case_study(client, monkeypatch):
    _seed_index(client, monkeypatch, [
        ("current-cs", [1.0, 0.0, 0.0]),
        ("other-doc", [0.9, 0.1, 0.0]),
    ])
    monkeypatch.setattr(rag, "embed_query", lambda q: [1.0, 0.0, 0.0])
    from db.session import SessionLocal
    db = SessionLocal()
    hits = retrieve(db, "q", exclude_slug="current-cs")
    db.close()
    assert [h.source_slug for h in hits] == ["other-doc"]


def test_empty_index_never_calls_embeddings(client, monkeypatch):
    from db.session import SessionLocal
    from models.rag_chunk import RagChunk

    db = SessionLocal()
    db.query(RagChunk).delete()
    db.commit()
    rag._cache["fp"] = None

    def boom(q):
        raise AssertionError("embed_query must not be called on an empty index")
    monkeypatch.setattr(rag, "embed_query", boom)

    assert retrieve(db, "q") == []
    db.close()


# ── mentor contract ──────────────────────────────────────────────────────────

def test_mentor_returns_grounded_answer_with_sources(client, monkeypatch):
    from services import mentor as mentor_svc
    from services.rag import Retrieved

    hit = Retrieved(0.82, "roadmap", "day-12-caching", "Day 12: Caching",
                    "Cache invalidation", "cache-invalidation", "TTLs bound staleness.")
    monkeypatch.setattr(mentor_svc, "retrieve", lambda db, q, **kw: [hit])

    captured = {}
    def fake_generate(system, user):
        captured["system"], captured["user"] = system, user
        return "Because of hot partitions [S1].", "groq"
    monkeypatch.setattr(mentor_svc, "_generate", fake_generate)

    slug = client.get("/casestudies").json()["case_studies"][0]["slug"]
    r = client.post("/ai/mentor", json={"case_study_slug": slug, "question": "Why?"})
    assert r.status_code == 200
    body = r.json()

    assert body["answer"] == "Because of hot partitions [S1]."
    assert body["grounded"] is True
    src = body["sources"][0]
    assert src["tag"] == "S1"
    assert src["path"] == "/learn/roadmap/day-12-caching#cache-invalidation"
    assert src["score"] == 0.82
    # Prompt carries both the case study AND the retrieved passage, tagged.
    assert "CASE STUDY:" in captured["user"]
    assert "[S1]" in captured["user"] and "TTLs bound staleness." in captured["user"]


def test_mentor_drops_retrieved_but_uncited_sources(client, monkeypatch):
    """The fix for the pizza-topping bug: retrieval returning chunks must not
    by itself produce citation chips — only chunks the model's [S#] tags
    actually reference should survive into `sources`, and `grounded` must
    track that, not the raw retrieval count."""
    from services import mentor as mentor_svc
    from services.rag import Retrieved

    hits = [
        Retrieved(0.52, "roadmap", "day-61-x", "Day 61: X", None, None, "irrelevant passage one"),
        Retrieved(0.52, "roadmap", "day-2-y", "Day 2: Y", None, None, "irrelevant passage two"),
    ]
    monkeypatch.setattr(mentor_svc, "retrieve", lambda db, q, **kw: hits)
    # The model correctly ignores both — no [S#] tags in its answer.
    monkeypatch.setattr(mentor_svc, "_generate",
                        lambda s, u: ("Let's get back to the case study at hand.", "groq"))

    slug = client.get("/casestudies").json()["case_studies"][0]["slug"]
    r = client.post("/ai/mentor", json={"case_study_slug": slug, "question": "Pizza?"})
    assert r.status_code == 200
    body = r.json()
    assert body["sources"] == []
    assert body["grounded"] is False


def test_mentor_degrades_gracefully_when_retrieval_fails(client, monkeypatch):
    """RAG failure must never take down the mentor — the pre-RAG contract."""
    from services import mentor as mentor_svc

    def broken_retrieve(db, q, **kw):
        raise RuntimeError("embeddings provider down")
    monkeypatch.setattr(mentor_svc, "retrieve", broken_retrieve)
    monkeypatch.setattr(mentor_svc, "_generate", lambda s, u: ("Plain answer.", "groq"))

    slug = client.get("/casestudies").json()["case_studies"][0]["slug"]
    r = client.post("/ai/mentor", json={"case_study_slug": slug, "question": "Why?"})
    assert r.status_code == 200
    assert r.json() == {"answer": "Plain answer.", "grounded": False,
                        "provider": "groq", "sources": []}
