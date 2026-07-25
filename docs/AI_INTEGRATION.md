# AI Integration — Architecture & Interview Notes

How SystemSim uses LLMs, and the WHY behind each decision. Written as
interview-prep material: every section is a talking point you can defend.

Current feature map (2026-07-25):

| Feature | Endpoint | Provider | Service |
|---|---|---|---|
| Simulation explainer | `POST /ai/explain` | **Gemini** (`gemini-3.5-flash`) | `services/ai_explain.py` → `services/gemini.py` |
| Case-study mentor | `POST /ai/mentor` | Claude (`claude-sonnet-4-20250514`) | `services/claude.py` |
| Roadmap lesson ingest | offline batch (`python -m services.roadmap_ingest`) | **Gemini** | `services/roadmap_ingest.py` → `services/gemini.py` |

---

## 1. Provider isolation — why two providers, and why it doesn't hurt

Each provider is one self-contained module: `services/claude.py` (Anthropic
SDK) and `services/gemini.py` (raw REST over `urllib`, no SDK dependency).
Nothing else in the codebase knows which vendor is behind a feature — routes
import a *feature service* (`ai_explain`, `claude.case_study_mentor`), never a
vendor client.

**History, because the WHY is the interview answer:**

- The original plan pinned all in-app AI to Claude (per spec). But the key we
  actually had was a Gemini key.
- 2026-07-16: roadmap ingest (a one-time content batch) shipped on Gemini as
  an *isolated* provider, precisely so the swap touched nothing else.
- 2026-07-25 (decision, Satyam): the simulation explainer moved to Gemini
  too — it was 503-ing behind a placeholder Anthropic key, and a working
  feature on the key you have beats a theoretical feature on the key you
  don't. The mentor stays on Claude, waiting on a real key.

**The point to make:** provider choice is a *deployment detail*, not an
architecture decision — because the seam is at the feature-service level.
Swapping the explainer between vendors was a one-import change in
`routes/ai.py`. Each provider raises its own `AIUnavailable` exception and
the route maps both onto the identical 503 contract, so the frontend never
knows or cares which vendor failed.

## 2. Where the model id lives — exactly one place per provider

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

**Controlled generation, not prose parsing.** The explainer requests
`responseMimeType: application/json` plus a `responseSchema`
(Gemini controlled generation):

```json
{ "summary": "...",
  "bottlenecks": [{ "node_id": "...", "label": "...", "why": "...", "fix": "..." }],
  "suggested_fixes": ["..."] }
```

WHY: the frontend renders sections and per-node cards (with "Show on canvas"
deep-links via `node_id`) — impossible with a text blob, fragile with
"please return JSON" prompting. The schema *guarantees* parseable, escaped
JSON; the roadmap ingest proved this out first (its multi-line markdown field
broke `json.loads` without it). `propertyOrdering` puts `summary` first so
the model commits to a verdict before arguing details.

**Validation after parsing.** Trust but verify: `_validate()` shape-checks
the parsed output, drops malformed bottleneck entries, and caps fixes at 3.
Off-contract output raises `AIUnavailable` → 503 → the UI's friendly
fallback. WHY: a half-rendered AI panel is worse than an honest "unavailable".

**Retry/backoff.** `gemini._post` retries 429/500/503 with exponential
backoff (3s → 6s → 12s, 4 attempts). WHY 429 specifically: the free tier
throttles hard (the roadmap ingest batch hit the *daily* quota mid-run —
HTTP 429 is a normal operating condition here, not an anomaly). Terminal
failures surface as `AIUnavailable`, never a raw stack trace.

**Graceful degradation.** No key → `AIUnavailable` → HTTP 503 → the frontend
shows "AI explanations aren't configured on this server yet" with a retry
affordance. The product is fully usable with zero AI keys; AI is progressive
enhancement, not a dependency.

**Gotcha worth telling:** on Gemini 2.5+/3.5, internal "thinking" tokens
count against `maxOutputTokens`. A 1024 cap truncated responses *mid-JSON*
(observed live). The cap is 4096 now — the visible JSON stays small; the cap
only bounds runaway cost.

## 5. Security — the key never leaves the backend

- `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` live in `backend/.env` (gitignored;
  `.env.example` documents the shape). Never in code, never in the repo.
- **The frontend NEVER calls an AI provider directly.** All AI traffic goes
  browser → FastAPI → provider. The browser bundle contains no AI key, no
  provider URL, no model name. Enforced structurally by the project rule that
  every network call lives in `frontend/src/api/client.js` — one file to
  audit.
- WHY beyond secrecy: the backend seam is also where prompt construction
  happens, so users can't tamper with the system prompt; and it's the future
  chokepoint for rate limiting, auth, caching, and logging.

## 6. Latency & UX

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

## 7. Before deploy — rate limiting (TODO)

`/ai/*` (and `/simulate`) have **no rate limiting yet** — tracked in
BACKEND_LOG's open items since 2026-07-08, and now urgent for `/ai/explain`:
every call burns free-tier Gemini quota, and the ingest already proved the
daily quota is reachable. Plan: per-IP (or per-user once auth is wired into
the sandbox) token bucket at the FastAPI layer, plus a low daily cap on
anonymous AI calls. Do this BEFORE any public URL exists.

## 8. How to swap providers later

The checklist that makes this a ~30-minute change, not a refactor:

1. Write (or reuse) a provider module exposing `generate_json(system, user,
   *, max_tokens, response_schema)` semantics and an `AIUnavailable`
   exception. (An OpenAI/anywhere version mirrors `services/gemini.py` —
   ~100 lines of REST.)
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
