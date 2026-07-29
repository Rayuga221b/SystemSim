# RAG — Retrieval-Augmented Generation for the SystemSim AI Assistant

**Status:** live · **Added:** 2026-07-28 · **Updated:** 2026-07-29 (citation
fix, general-knowledge fallback, floating global assistant, DB rate limit) ·
**Owner docs:** this file + `backend/BACKEND_LOG.md` (build log) ·
**Related:** `docs/AI_INTEGRATION.md` (provider architecture)

Two surfaces share one RAG-grounded generation core (`services/mentor.py`):
the per-case-study mentor widget (`POST /ai/mentor`) and the floating global
assistant (`POST /ai/chat`, §4) that's available on every page. Before
generating, both retrieve the most relevant passages from a corpus of
**76 roadmap lessons + 7 case studies** (chunked to 499 passages) and cite
them in the answer. This document explains the architecture, every tradeoff
behind it, and the scaling path — written so any engineer (or interviewer)
can follow the reasoning, not just the code.

---

## 1. Why RAG here at all

The pre-RAG mentor stuffed one case study's full text into every prompt and
hoped the model free-recalled everything else. Two problems:

1. **Grounding gap.** Ask "what's a hot partition?" on the Discord study and
   the answer came from the model's general training — while our own Day-N
   lesson teaching exactly that sat unused in the database. The product's
   moat *is* its content; answers should be built from it.
2. **Token ceiling.** "Put everything in the prompt" doesn't scale past one
   document. The moment the mentor should know about *related* lessons, full
   stuffing is O(corpus) tokens per question. Retrieval makes prompt cost
   O(k) — constant, regardless of how much content we add.

RAG also gives us something stuffing never can: **verifiable citations.**
Every answer ships with links to the exact sections it drew on.

## 2. Architecture

```mermaid
flowchart TD
  subgraph Ingest["Index build (offline, idempotent)"]
    RL[(roadmap_lessons)] --> CH[Chunker]
    CS[case_studies.json] --> CH
    CH -->|"~500 chunks"| EMB1[Gemini embeddings\nRETRIEVAL_DOCUMENT]
    EMB1 --> RC[(rag_chunks)]
  end

  subgraph Query["Per question (online) — POST /ai/mentor or /ai/chat"]
    Q([User question +\ncontext: case_study / sandbox / none]) --> EMB2[Gemini embeddings\nRETRIEVAL_QUERY]
    RC -->|load once, cache| MAT[In-process matrix\n~500 × 768 float32]
    EMB2 --> COS[Exact cosine\nmatrix · vector]
    MAT --> COS
    COS -->|top-4, score ≥ 0.45,\nmax 2 per source| PROMPT[Prompt assembly:\ncontext + passages + question]
    PROMPT --> GEN{Claude configured?}
    GEN -- yes --> C[Claude]
    GEN -- no --> G[Groq llama-3.3-70b]
    C --> CITE[Filter sources to\nactually-cited [S#] tags]
    G --> CITE
    CITE --> RESP[answer + sources + grounded]
    RESP -->|/ai/chat only, auth required| PERSIST[(ai_messages)]
  end
```

Files (each does one thing):

| File | Responsibility |
|---|---|
| `backend/services/rag.py` | Chunking + retrieval (the algorithmic core) |
| `backend/services/embeddings.py` | Gemini embeddings provider (isolated, REST) |
| `backend/services/rag_index.py` | CLI: corpus → chunks → embeddings → DB |
| `backend/services/mentor.py` | Shared core: retrieve → prompt (3 context modes) → generate → filter citations |
| `backend/services/chat.py` | `/ai/chat` only: persistence + DB-backed rate limit on top of `mentor.py` |
| `backend/models/rag_chunk.py` | The `rag_chunks` table |
| `backend/models/ai_message.py` | The `ai_messages` table (floating assistant history) |
| `frontend/.../SourceChips.jsx` | Shared "Grounded in" citation chip UI |
| `frontend/.../CaseStudyDetail.jsx` | Per-case-study mentor widget |
| `frontend/.../FloatingChat.jsx` | The global floating assistant, mounted once in `App.jsx` |

## 3. The decisions, with tradeoffs

### 3.1 No vector database — exact search over an in-process matrix

**The headline decision, so the math goes first.** The corpus is ~500 chunks
× 768 dims × 4 bytes ≈ **1.7 MB**. One `numpy` matrix-vector product over
that is exact (100% recall) and takes well under a millisecond. An ANN index
(pgvector HNSW, FAISS, a managed vector DB) exists to make search *cheaper
than exact* at scales where exact is slow — it pays for that with
approximate recall, index build/maintenance, and an infrastructure
dependency. Below ~50k vectors the exact scan is still single-digit
milliseconds; adopting a vector DB here would be paying ANN's costs while
needing none of its benefit.

**Trigger to revisit:** corpus > ~50k chunks or p95 retrieval > ~20 ms.
**Upgrade path (deliberately cheap):** embeddings already live in Postgres
rows — swap the JSON column for a pgvector `vector(768)` column, add an HNSW
index, and replace the numpy dot product in `rag.retrieve()` with an
`ORDER BY embedding <=> :q LIMIT k` query. Chunking, prompting, citations,
and the API contract are untouched; `retrieve()` is the seam.

### 3.2 Embeddings on Gemini, generation on Claude→Groq

Constraint-driven, and honestly so: Groq (our quota-bearing generation key)
offers **no embeddings endpoint**; the Gemini key is real and its embeddings
tier is free; the Anthropic key is still a placeholder. So:

- **Embeddings:** `gemini-embedding-001`, isolated in
  `services/embeddings.py` (same provider-isolation rule as claude/gemini/
  groq — a swap touches one file).
- **Generation:** chain, not load-balancer — Claude when a key exists
  (quality preference, per the original decision), else Groq
  `llama-3.3-70b-versatile`. A deployed product must not ship a mentor that
  503s behind a placeholder key; this supersedes "mentor stays on Claude"
  (2026-07-26) *operationally* while preserving it as the preference.

One coupling worth naming in an interview: **the embedding model choice is
sticky in a way generation is not.** Stored vectors are only comparable to
queries embedded by the same model — swapping generation is a config change;
swapping embeddings means re-embedding the corpus. Cheap at ~500 chunks
(one `--force` rebuild), but the asymmetry is why the two live in separate
modules with separate env vars.

Also: document vs. query **task types** (`RETRIEVAL_DOCUMENT` /
`RETRIEVAL_QUERY`). Gemini's retrieval embeddings are asymmetric — short
questions are projected differently from long passages so they still land
near each other. Using one task type for both silently degrades recall; the
provider encodes the right one per call site so callers can't get it wrong.

### 3.3 Chunking: the document's own structure, not fixed windows

`chunk_markdown()` cuts at `##` headings — the semantic boundaries the
content already has — so a chunk never mixes two topics. Oversized sections
split on paragraph boundaries with a one-paragraph overlap (a sentence
straddling a cut exists in both chunks). Fenced code blocks are stashed and
restored around the split so a chunk never contains half a code block.
Target ≈ 1,600 chars (~400 tokens): small enough that a hit is *about* the
question (precision, prompt cost), large enough to carry a complete thought.

Two retrieval-quality details that cost little and matter a lot:

- **Context-prefixed embedding text.** A chunk saying "it uses consistent
  hashing" embeds poorly in isolation; we embed
  `"Day 12: Caching — Cache invalidation\n\n<passage>"` while storing the
  clean passage for the prompt. Classic fix for the "pronouns lose their
  antecedent" chunking failure.
- **Anchors mirror the frontend's heading-slugify**, so a citation deep-links
  to the exact rendered section (`/learn/roadmap/<slug>#cache-invalidation`,
  and case-study chunks reuse the page's existing `#problem` / `#solution` /
  `#lessons` section ids).
- **Reader-instruction boilerplate is excluded at chunk time.** Every lesson
  ends with a "Try it in the sandbox" activity nudge (the ingest prompt
  requires it) — near-identical in spirit across all 76 lessons. It chunks
  and embeds fine, but it's an instruction to the reader ("go build this"),
  not explanatory content; citing it as grounding is technically correct and
  practically useless. FIX (2026-07-29, found live): it surfaced as a
  citation chip (`Day 54 › Try it in the sandbox`) next to real technical
  sources, diluting them. `chunk_markdown()` now skips any section whose
  heading starts with that phrase (case-insensitive — lessons vary between
  "...in the sandbox" and "...in the Sandbox"), dropping 48 chunks from the
  index (547 → 499) with **zero re-embedding cost** — the diff-based build
  (§3.7) treats removed sections as pure deletions.

### 3.4 Retrieval policy

Top-4 chunks, cosine floor 0.45, **max 2 chunks per source document**
(diversity — one lesson can't monopolize the context), and the current case
study's own chunks are excluded (its full text is already in the prompt;
retrieving it again would waste slots on duplicates). The floor matters more
than top-k: retrieval *always* returns nearest neighbors, relevant or not —
without a floor, an off-topic question decorates the prompt with noise and
invites the model to cite it.

### 3.5 Citations must be actually cited, not merely retrieved

The `sources` array returned to the frontend is assembled from **retrieval
metadata**, never parsed from the model's own words — the model physically
cannot invent a source that wasn't retrieved. That was true from the start
and is still the anti-hallucination property worth naming. But it wasn't the
whole story.

**FIX (2026-07-29, found live).** Asked the mentor *"What's your favorite
pizza topping?"* on the Discord case study. It correctly declined and
redirected — but the response still came back `grounded: true` with 4
citation chips (unrelated roadmap lessons), and none of their `[S#]` tags
appeared anywhere in the answer. Checked the raw scores: 0.52–0.525, just
over the 0.45 floor — noise-level cosine similarity that almost any
professional-sounding English gets against a technical corpus. The model
followed its instructions and ignored all four; the API returned them anyway
because `sources` was populated from *what retrieval found*, not from *what
the answer used*.

**The fix is a filter, not a threshold hunt.** Tuning `MIN_SCORE` higher
would only move where the false positives happen, since "is this cosine
score high enough" and "did the model actually rely on this passage" are
different questions — the second one is strictly what a citation is *for*.
`_cited_sources()` now regexes the generated answer for `[S(\d+)]` and keeps
only chunks whose tag was actually referenced; `grounded` is derived from
that survivor list, not from `bool(chunks)`. A retrieved-but-unused chunk
now simply doesn't reach the response. This is more robust than any score
cutoff could be, because it never needs to be right about relevance in
advance — it just checks what happened.

### 3.6 Failure contract: RAG is an enhancement, never a dependency

Orders of degradation, each explicitly handled:

| Failure | Behavior |
|---|---|
| Index empty (fresh deploy, pre-build) | `retrieve()` returns `[]` **without calling the embeddings API**; answers from context alone (`grounded: false`) |
| Embeddings API down/quota'd at query time | Same degradation — any retrieval exception is caught in `mentor.respond()` |
| Claude unavailable (incl. a placeholder key returning 401 — verified live) | Groq fallback, transparently (`provider` in response) — the chain catches any exception from the preferred provider, not just "not configured" |
| Both generation providers unavailable | 503 — same contract the frontend already handled |

The invariant: **adding RAG must not add a new way for the mentor to be
down.** Retrieval failing loses grounding, not the feature.

### 3.7 Index builds are idempotent and diff-based

`python -m services.rag_index build` diffs desired chunks against stored
ones by content hash: unchanged → skip (no embedding call), changed/new →
embed, orphaned → delete. Editing one lesson re-embeds only that lesson;
re-running after a crash resumes for free; running twice is a no-op. Same
principle that carried the roadmap ingest through its quota wall (see
`BACKEND_LOG.md` 2026-07-27): **the expensive rate-limited resource is the
API call, so the design's job is to never repeat one it doesn't have to.**
Rate limits are handled by honoring the `retryDelay` hint Gemini returns in
429 bodies rather than guessing with blind exponential backoff.

The index is **derived data**: sources of truth stay in `roadmap_lessons`
and `case_studies.json`; dropping `rag_chunks` loses nothing a rebuild can't
restore.

### 3.8 Cache invalidation without a message bus

The in-process matrix is cached and re-validated per request with one cheap
aggregate query — `(COUNT(*), MAX(created_at))` as a fingerprint. Both change
on any rebuild, so a rebuilt index is picked up on the next question with no
restart, no pub/sub, no TTL staleness window. At one aggregate query per
mentor question (a request that already spends 1-3 s on an LLM), the check
is free; if the fingerprint query ever showed up in a profile, a short TTL
on it is the first fix.

## 4. The floating global assistant

`POST /ai/chat` (+ `GET /ai/chat/history`) is a second surface over the same
`services/mentor.py` core — a chat bubble available on every page
(`frontend/.../FloatingChat.jsx`), not just the case-study reader. Three
decisions here, each with a concrete reason:

### 4.1 One core, three context modes

`mentor.respond()` takes `case_study` xor `sandbox` xor neither:

| Route context | Sent to the model | Where it triggers |
|---|---|---|
| `case_study` | Full case-study fields (same as `/ai/mentor`) | `/case-studies/:slug` |
| `sandbox` | Current graph (`serializeGraph()`) + last simulation result | `/sandbox` |
| `general` | Nothing but retrieved platform passages | anywhere else |

All three still run retrieval over the whole corpus — `sandbox` mode means
"also ground in what's on the user's canvas right now," not "skip the
roadmap/case-study corpus." The route just decides what extra context to
prepend before the shared retrieval-and-generation pipeline runs.

### 4.2 A bounded general-knowledge fallback, not open-ended chat

`CLAUDE.md`'s "AI calls are always context-scoped — never open-ended chat"
rule is a good rule and mostly still holds. DECISION (2026-07-29, the one
deliberate carve-out): the system prompt now has an explicit PRIORITY ORDER —
(1) ground in given CONTEXT, (2) ground in relevant PLATFORM PASSAGES,
(3) **only if neither applies**, answer from general engineering knowledge,
clearly labeled ("Outside SystemSim's own content, but generally
speaking…"). Verified live: asking the case-study mentor to explain CAP
theorem "in general" correctly produced a labeled general answer instead of
the old behavior (a bare redirect). This isn't unscoped chat — retrieval
still runs first every time, and step 3 only fires for the minority of
questions where steps 1–2 genuinely found nothing. A truly off-topic
question (§3.5's pizza example) still gets a redirect, because there's nothing
in scope 1–3 for the model to answer *from* — the fallback is "answer
generally when we have nothing platform-specific," not "always try to
answer everything."

### 4.3 Auth-gating is the rate limit's precondition, not the limit itself

The floating widget is enabled only for signed-in users (`get_current_user`,
no anonymous path) — this is stricter than `/ai/mentor`, deliberately.
**Auth-gating alone is not a rate limit** — it's what makes one *possible*:
`services/chat.py._check_rate_limit()` does a plain `SELECT COUNT(*)` over
`ai_messages` for `(user_id, role='user', created_at >= now - 10min)` and
rejects with `429` + `Retry-After` past 20 messages. An anonymous endpoint
has no stable identity to count against (IP is spoofable and punishes
shared networks); attributing every message to a `user_id` is the only
reason a count-based cap works at all. No Redis — same reasoning as "no
vector database" (§3.1): one indexed COUNT query is faster than the LLM
call it's gating, at this scale. Documented upgrade: a Redis sliding-window
counter behind the same `_check_rate_limit()` signature if this ever shows
up in a profile.

Every message (both roles) persists to `ai_messages`, scoped by
`(context_type, context_slug)` so `GET /ai/chat/history` replays the right
thread when a user reopens the widget on a given page — case-study
conversations don't bleed into the general thread or vice versa. Sending is
resilient in the same spirit as retrieval (§3.6): the user's message commits
*before* generation runs, so a provider outage loses the answer, never the
question — an honest "you asked this and didn't get a reply" beats silently
discarding it.

One real bug this surfaced: SQLite hands back a **naive** `datetime` from a
`DateTime(timezone=True)` column on read, even though it was written as UTC
— only Postgres round-trips tzinfo correctly. The retry-after computation in
`_check_rate_limit()` normalizes with `.replace(tzinfo=timezone.utc)` before
subtracting; worth remembering for any other code that reads timestamps back
out of this schema, given the project runs SQLite in dev and Postgres in
prod (`backend/BACKEND_LOG.md` 2026-07-28).

## 5. Cost & performance profile

Per question (all numbers order-of-magnitude):

| Step | Cost |
|---|---|
| Query embedding | 1 Gemini call, free tier, ~100 ms |
| Retrieval | ~499-row matrix product, < 1 ms, in-process |
| Prompt | context (case study / sandbox / none) + up to 4 chunks ≈ 2.5–3.5k tokens |
| Generation | 1 Claude/Groq call, ~700 max output tokens |
| Rate limit check | 1 indexed COUNT query, sub-ms |
| Persistence | 2 inserts (user turn, assistant turn) |

Index build: ~500 chunks ≈ 32 batch embedding calls, free tier, minutes —
and only on content change, only for changed chunks.

## 6. What I'd build next (ordered)

1. **Retrieval evaluation set.** ~30 question→expected-chunk pairs run in CI;
   without it, threshold/chunking tweaks are vibes. The chunk anchors make
   labeling cheap.
2. **Rate limiting on `/ai/explain`** — `/ai/chat` and `/ai/mentor` are now
   covered (mentor indirectly, via the same underlying provider chain being
   protected on the chat surface); `/ai/explain` is still open, since it has
   no auth requirement to hang a limit on. Would need either an anonymous
   IP-based limiter or moving it behind auth too.
3. **Hybrid retrieval (BM25 + vectors)** if eval shows misses on exact-term
   queries (component names, acronyms) — Postgres full-text search covers
   the lexical side without new infra.
4. **pgvector migration** at the documented trigger, not before.

## 7. Interview cheat-sheet (the 60-second version)

> The AI assistant is RAG-grounded over our own course content, and it's one
> core behind two surfaces — a per-case-study mentor and a floating global
> chat available everywhere. At index time I chunk markdown on its heading
> structure with paragraph-overlap splitting (excluding reader-instruction
> boilerplate, which I found being cited despite being useless as grounding),
> embed with Gemini's asymmetric retrieval embeddings, and store vectors in
> Postgres rows. At query time I do **exact** cosine over an in-process numpy
> matrix — the corpus is ~500 chunks ≈ 1.5 MB, so an ANN index would add
> infrastructure and recall loss to make a sub-millisecond operation faster;
> pgvector is the documented upgrade at ~50k chunks and the swap is isolated
> to one function. Citations are filtered to what the model actually cited,
> not just what was retrieved — I found a real bug where a fully off-topic
> question still returned four irrelevant "grounded in" chips because
> retrieval always returns nearest neighbors regardless of relevance; the
> fix was checking the model's own `[S#]` references, not tuning a score
> threshold, because that's a more fundamental question than any cutoff can
> answer. The system prompt has an explicit priority order — platform
> content first, general engineering knowledge only as a labeled last
> resort — which is a deliberate, narrow exception to this project's
> "no open-ended chat" rule, not an abandonment of it: retrieval still runs
> every time, the fallback only fires when nothing platform-specific
> applies. The floating assistant is auth-gated specifically so a DB-backed
> rate limit has an identity to count against — auth alone isn't a rate
> limit, it's the limit's precondition. Retrieval failure degrades to the
> ungrounded prompt rather than 503ing — RAG is an enhancement, not a
> dependency. Index builds are content-hash-diffed and idempotent, because
> the rate-limited embedding API is the scarce resource. The eval set is the
> honest gap: retrieval changes are currently judgment, not measurement.
