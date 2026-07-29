# AI Integration — Architecture & Interview Notes

How SystemSim uses LLMs, and the WHY behind each decision. Written as
interview-prep material: every section is a talking point you can defend.

Current feature map (2026-07-29):

| Feature | Endpoint | Provider | Service |
|---|---|---|---|
| Simulation explainer | `POST /ai/explain` | **Groq** (`llama-3.3-70b-versatile`) | `services/ai_explain.py` → `services/groq.py` |
| Case-study mentor (**RAG-grounded**) | `POST /ai/mentor` | chain: Claude → **Groq** fallback | `services/mentor.py` → `services/rag.py` |
| Floating global assistant (**RAG-grounded, auth required**) | `POST /ai/chat`, `GET /ai/chat/history` | chain: Claude → **Groq** fallback | `services/chat.py` → `services/mentor.py` |
| RAG embeddings | offline index + per-query | **Gemini** (`gemini-embedding-001`) | `services/embeddings.py` |
| Roadmap lesson ingest | offline batch (`python -m services.roadmap_ingest`) — **complete, 76/76 published** | **Groq** (`qwen/qwen3.6-27b`) | `services/roadmap_ingest.py` → `services/groq.py` |

The mentor and the floating assistant share one grounded-generation core
(`services/mentor.py`) — retrieval, prompt priority order (platform content
first, general knowledge only as a labeled last resort), the citation
contract, and the provider chain live in exactly one place. `services/chat.py`
adds only what the floating surface needs on top: per-user persistence and a
DB-backed rate limit (the reason it requires login where the case-study
mentor doesn't). Full deep-dive, including corpus/chunking/retrieval design
and both live-testing bugs found and fixed: **`docs/RAG.md`**.
(`services/gemini.py` generation is kept intact for swap-back; the Gemini
key now actively serves embeddings only.)

---

## 1. Provider isolation — why multiple providers, and why it doesn't hurt

Each provider is one self-contained module: `services/claude.py` (Anthropic
SDK), `services/gemini.py` and `services/groq.py` (raw REST over `urllib`,
no SDK dependency). Nothing else in the codebase knows which vendor is behind
a feature — routes import a *feature service* (`ai_explain`,
`claude.case_study_mentor`), never a vendor client.

**History, because the WHY is the interview answer:**

- The original plan pinned all in-app AI to Claude (per spec). But the key we
  actually had was a Gemini key.
- 2026-07-16: roadmap ingest (a one-time content batch) shipped on Gemini as
  an *isolated* provider, precisely so the swap touched nothing else.
- 2026-07-25 (decision, Satyam): the simulation explainer moved to Gemini
  too — it was 503-ing behind a placeholder Anthropic key, and a working
  feature on the key you have beats a theoretical feature on the key you
  don't. The mentor stays on Claude, waiting on a real key.
- 2026-07-26 (decision, Satyam): both Gemini features moved to **Groq**
  (`services/groq.py`, OpenAI-compatible REST) — the Groq key is the one with
  usable quota. The explainer runs on `llama-3.3-70b-versatile`, the ingest
  on `qwen/qwen3.6-27b`. The swap was exactly what the seam promised: one
  import in `ai_explain.py` / `roadmap_ingest.py` plus the route's exception
  mapping; the tests passed unchanged.

**The point to make:** provider choice is a *deployment detail*, not an
architecture decision — because the seam is at the feature-service level.
Swapping the explainer between vendors was a one-import change in
`routes/ai.py`. Each provider raises its own `AIUnavailable` exception and
the route maps both onto the identical 503 contract, so the frontend never
knows or cares which vendor failed.

## 2. Where the model id lives — exactly one place per provider

- Groq: `GROQ_MODEL` (explainer, default `llama-3.3-70b-versatile`) and
  `GROQ_INGEST_MODEL` (ingest, default `qwen/qwen3.6-27b`), read once in
  `services/groq.py`.
- Gemini: `GEMINI_MODEL` env var, read once in `services/gemini.py`
  (default `gemini-2.5-flash` in code; `.env` pins `gemini-3.5-flash` because
  2.5 is blocked for new API projects).
- Claude: `CLAUDE_MODEL` env var, read once in `services/claude.py`.

WHY: model churn is constant (the spec's pinned Sonnet was outdated within
months). A model upgrade must be a config change, not a code hunt. No route,
test, or frontend file ever names a model.

## 3. Prompt curation — context-scoping and token-cost control

**Project rule: AI calls are ALWAYS context-scoped, never open-ended chat.**
Every prompt carries concrete state — the user's graph + simulation numbers,
or one case study's text. WHY three ways:

1. **Relevance** — the model explains *this* diagram, citing *these* numbers;
   it can't drift into generic system-design essays.
2. **Predictable token cost** — input size is bounded by the graph cap
   (60 nodes, enforced by the `/simulate` Pydantic model), so cost per call
   has a known ceiling.
3. **No chatbot surface** — there's no free-text prompt for users to jailbreak
   or wander with; the "question" in the mentor is scoped to one case study
   and the system prompt redirects off-topic asks.

**Serialization strategy** (`services/ai_explain.py`): the canvas graph is
NOT sent as raw JSON. It's flattened to a line-per-node text form —
`id | type | label | config` plus `source -> target` edge lines — dropping
React Flow noise (positions, styling). The sim result is slimmed to what
carries signal: statuses, the bottleneck list, per-node metrics for
*non-healthy nodes only*, throughput, warnings, tradeoffs. Two wins: fewer
tokens, and a format the model grounds against more reliably than nested
JSON (it must cite exact node ids and labels back, and it does).

The system prompt pins the persona ("pragmatic senior engineer"), forbids
inventing components or metrics, and specifies the exact meaning of each
output field — including the healthy-design case (empty bottlenecks + "what
to stress next" suggestions), so the feature is useful even when nothing is
red.

## 4. Response management — structured output end to end

**Structured output, not prose parsing.** The explainer requests Groq JSON
mode (`response_format: {"type": "json_object"}` — guarantees syntactically
valid JSON) and injects the response schema into the system prompt (Groq's
schema-*enforced* structured outputs only cover its GPT-OSS models; on Gemini
this same schema rode the native `responseSchema` controlled generation):

```json
{ "summary": "...",
  "bottlenecks": [{ "node_id": "...", "label": "...", "why": "...", "fix": "..." }],
  "suggested_fixes": ["..."] }
```

WHY: the frontend renders sections and per-node cards (with "Show on canvas"
deep-links via `node_id`) — impossible with a text blob, fragile with
"please return JSON" prompting. The roadmap ingest proved the need first
(its multi-line markdown field broke `json.loads` under free-text
prompting); JSON mode plus the injected schema plus `_validate()` as the
backstop is the fix.

**Correction, from the field (2026-07-27):** `json_object` mode makes
invalid JSON *rare*, not impossible — one roadmap ingest day hit Groq's own
`HTTP 400 json_validate_failed` (the model's generation failed Groq's
server-side JSON check, not ours). The real safety net was never the mode's
guarantee; it's that the ingest already treats every unit of work (one day,
one call) as independently retryable and skips-not-aborts on failure. Don't
oversell a provider guarantee in an interview — describe the retry/skip
design that makes the guarantee's occasional failure harmless instead.

**Validation after parsing.** Trust but verify: `_validate()` shape-checks
the parsed output, drops malformed bottleneck entries, and caps fixes at 3.
Off-contract output raises `AIUnavailable` → 503 → the UI's friendly
fallback. WHY: a half-rendered AI panel is worse than an honest "unavailable".

**Retry/backoff.** `groq._post` retries 429/500/502/503, honoring Groq's
`retry-after` header on 429 (falling back to exponential backoff). WHY 429
specifically: the free tier throttles per minute AND per day — HTTP 429 is a
normal operating condition here, not an anomaly. Groq also rejects
oversized requests outright (HTTP 413: `prompt + max_completion_tokens`
checked against the per-minute cap at request time — never retryable), so
the ingest budgets both sides of every request. Terminal failures surface as
`AIUnavailable`, never a raw stack trace.

**Graceful degradation.** No key → `AIUnavailable` → HTTP 503 → the frontend
shows "AI explanations aren't configured on this server yet" with a retry
affordance. The product is fully usable with zero AI keys; AI is progressive
enhancement, not a dependency.

**Gotchas worth telling (observed live, one per provider):**
- Gemini 2.5+/3.5: internal "thinking" tokens count against
  `maxOutputTokens` — a 1024 cap truncated responses *mid-JSON*. Cap is 4096.
- Groq: Cloudflare fronts `api.groq.com` and 403s urllib's default
  `Python-urllib/x.y` User-Agent (error 1010) — the provider sends an
  explicit UA. And reasoning models (qwen) burn completion tokens on
  thinking before emitting JSON; the ingest sends `reasoning_effort: "none"`
  because truncated thinking fails Groq's JSON-mode validation outright.

## 5. Batch ingest resilience — RPM vs TPM vs TPD, and why idempotency beats retrying harder

The roadmap ingest is the one AI feature that's a **long-running offline
batch** (76 sequential model calls), not a single request-response — a
different failure surface than `/ai/explain`, worth its own interview
answer.

**Three rate-limit dimensions, only two of which a retry loop can absorb.**
Groq's free tier caps *requests per minute*, *tokens per minute*, and
*tokens per day*. `groq._post` retries the first two (their `retry-after`
is seconds to low-minutes — cheap to wait out). The daily cap is different
in kind: the wait it reports can be 30-40 minutes and shrinks unpredictably
run to run. Stretching the in-process retry to cover it would mean a batch
job blocking for most of an hour on one HTTP call — a worse failure mode
than just failing that unit of work. **The fix isn't a longer retry; it's
making failure cheap to recover from at a higher layer.**

**That's what the per-day idempotent upsert buys.** `upsert()` keys on
`RoadmapLesson.day` (unique) — re-running a batch that includes already-done
days is a no-op for those days. Combined with `ingest_days()` already
catching exceptions per-day and reporting failures instead of aborting
(2026-07-16 decision), a batch that dies at day 53 of 76 for *any* reason —
daily quota, a dropped connection, the host process itself exiting — needs
no bookkeeping to resume: query which days exist, and pass the rest back in.
**The interview point:** for a multi-unit batch job, invest in cheap,
verifiable resumability (idempotent writes + a state you can query) over
investing in the retry loop surviving longer. Retries handle transient
failures; idempotency handles the failure modes retries can't cover
(process death, daily quotas, anything measured in tens of minutes).

**Corollary: trust the data, not the process status.** When the batch's own
host session ended mid-run, the background task's own completion signal was
ambiguous ("may have been running when the process exited"). The
trustworthy check was `SELECT day FROM roadmap_lessons` against the
curriculum's 76 expected days — the persisted state *is* the ground truth
for a job built around idempotent per-unit writes, so verifying it directly
is both correct and the path of least effort.

## 6. Security — the key never leaves the backend

- `GROQ_API_KEY` / `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` live in
  `backend/.env` (gitignored; `.env.example` documents the shape). Never in
  code, never in the repo.
- **The frontend NEVER calls an AI provider directly.** All AI traffic goes
  browser → FastAPI → provider. The browser bundle contains no AI key, no
  provider URL, no model name. Enforced structurally by the project rule that
  every network call lives in `frontend/src/api/client.js` — one file to
  audit.
- WHY beyond secrecy: the backend seam is also where prompt construction
  happens, so users can't tamper with the system prompt; and it's the future
  chokepoint for rate limiting, auth, caching, and logging.

## 7. Latency & UX

- LLM calls are seconds, not the ~10ms sim loop, so the two are decoupled:
  simulation results render immediately (the canvas is optimistic — project
  rule), and the AI explanation is an explicit, on-demand action.
- Two entry points on the Sandbox: a fixed "Explain my design" footer button
  in the results panel, and a floating "Ask AI" pill on the canvas that
  appears once a result exists. Both open a drawer with an honest loading
  state ("Reading your architecture and the simulation numbers…").
- **Per-result caching in the store:** the explanation is fetched once per
  simulation run and cached in `simulationSlice`; reopening the drawer is
  free, and a new run clears it. WHY: identical input ⇒ identical answer —
  paying the provider twice for the same graph+result is waste.
- Error and 503 states render inside the drawer with a "Try again" button —
  the retry re-uses the same fetch path.
- Not streamed (the spec imagined streaming): structured JSON renders as a
  complete card set; streaming partial JSON adds parsing complexity for
  little perceived-latency win at ~2-4s responses. Revisit if latency grows.

## 8. Before deploy — rate limiting (TODO)

`/ai/*` (and `/simulate`) have **no rate limiting yet** — tracked in
BACKEND_LOG's open items since 2026-07-08, and now urgent for `/ai/explain`:
every call burns free-tier Groq quota (per-minute AND per-day caps), and the
ingest already proved the daily quota is reachable. Plan: per-IP (or per-user once auth is wired into
the sandbox) token bucket at the FastAPI layer, plus a low daily cap on
anonymous AI calls. Do this BEFORE any public URL exists.

## 9. How to swap providers later

The checklist that makes this a ~30-minute change, not a refactor:

1. Write (or reuse) a provider module exposing `generate_json(system, user,
   *, max_tokens, response_schema)` semantics and an `AIUnavailable`
   exception. (`services/groq.py` is the proof: an OpenAI-compatible mirror
   of `services/gemini.py` in ~150 lines of REST, written in one sitting for
   the 2026-07-26 swap.)
2. Point the feature service's import at it (`services/ai_explain.py` imports
   `generate_json` + `AIUnavailable` from exactly one place).
3. Map the schema: Gemini's `responseSchema` ↔ Anthropic tool-use /
   `output_json` ↔ OpenAI `response_format: json_schema` — same contract,
   different envelope. Keep the *response shape* identical so the frontend
   and tests don't change.
4. Add the key + model env vars; update `.env.example`.
5. Tests already mock at the feature-service seam
   (`monkeypatch.setattr(ai_explain, "generate_json", …)`), so they pass
   unchanged — which is the proof the seam is in the right place.

Anti-goal: a generic multi-provider abstraction layer. Two small concrete
modules beat a premature `LLMProvider` interface; the isolation is the
abstraction.
