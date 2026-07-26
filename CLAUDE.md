# SystemSim — Project Memory

Interactive distributed-systems learning platform. Users visually design systems
on a canvas, simulate load to find bottlenecks, learn from real company case
studies, and practice scored challenges.

This file is read at the start of every Claude Code session. Keep it lean.
Component-specific rules live in `frontend/CLAUDE.md` and `backend/CLAUDE.md`
(loaded lazily when you work in those trees).

---

## The three modes

- **Sandbox** — free canvas: drag/connect/configure 14 components, set load,
  simulate, see bottleneck highlights + tradeoff scores.
- **Challenges** — structured scenarios (e.g. "Design a URL Shortener"); user
  builds, gets scored against a reference architecture.
- **Case Studies** — real company incidents (Discord, Twitter, Slack…),
  structured Problem → Solution → "Simulate This" (opens a pre-loaded canvas).

## Stack (do not swap without a decision note below)

- Frontend: React + Vite, React Flow (canvas), Tailwind, shadcn/ui, Zustand
- Backend: FastAPI (Python), NetworkX (graph), BeautifulSoup (scraping)
- DB/Auth: self-hosted Postgres + custom FastAPI auth (SQLAlchemy + Alembic +
  JWT). Local via docker-compose; AWS later. (Swapped from Supabase — see
  "Auth swap" note under Decisions.)
- AI: split by feature — the **simulation explainer** and roadmap ingest run
  on **Groq** (isolated provider `services/groq.py`; explainer =
  `GROQ_MODEL`, default `llama-3.3-70b-versatile`; ingest =
  `GROQ_INGEST_MODEL`, default `qwen/qwen3.6-27b`); the **case-study mentor**
  stays on Claude API — model `claude-sonnet-4-20250514` (see NOTE under
  Decisions). `services/gemini.py` is kept for swap-back but unused by
  default. See "Explainer + ingest on Groq" under Decisions, and
  `docs/AI_INTEGRATION.md` for the full architecture.
- Content rendering: `react-markdown` + `remark-gfm` + `rehype-highlight`
  (roadmap lessons), `mermaid` (flowcharts). Long-form only; UI stays on Prose.
- Hosting: Vercel (frontend), AWS (backend + Postgres) — was Render/Supabase

---

## Architectural decisions (the WHY — honor these)

- **Simulation is stateless.** No server session. The full graph is sent with
  every `/simulate` request. WHY: simple to reason about, trivially scalable,
  easy to test in isolation.
- **Simulation engine uses the Strategy pattern.** Each component type is its
  own class with one interface: `process(load_rps) -> (output_rps, status)`.
  WHY: adding a 15th component = one new class, no edits to the traversal.
- **Challenges & scenarios are JSON data, not code.** Stored in
  `backend/data/challenges.json`. WHY: content authored without redeploys;
  keeps logic generic.
- **Case studies are AI-structured summaries, never raw scraped HTML.** WHY:
  copyright-safe, consistent shape, small to store.
- **Learn Roadmap content lives in the DB, not JSON — the deliberate exception
  to "content = JSON".** DECISION (2026-07-16): the 76-lesson System Design
  Roadmap is a `roadmap_lessons` table (`backend/models/roadmap_lesson.py`),
  served via `GET /roadmap` + `/roadmap/{slug}`. WHY: it's long-form, growing
  content that wants per-lesson queries, published/draft state, and later
  per-user progress — not a blob loaded whole. Curriculum grouping/order is
  config (`data/roadmap_curriculum.json`), lesson bodies are data (DB).
- **Roadmap lessons are ORIGINAL, AI-restructured content — same copyright-safe
  principle as case studies.** The source series (Sunchit Dudeja, NO license =
  all rights reserved) is used ONLY as reference input to the ingest pipeline
  (`services/roadmap_ingest.py`): fetched at ingest time, cached to a gitignored
  dir, NEVER committed or served verbatim. The model rewrites each doc into an
  original lesson. Nothing verbatim is stored.
- **Ingest uses Gemini; in-app AI stays Claude.** DECISION (2026-07-16): we had
  a Gemini key, not Anthropic, so roadmap ingestion runs on an isolated Gemini
  provider (`services/gemini.py`, REST, no SDK, `GEMINI_MODEL` env). The runtime
  AI features (explain/mentor) remain on Claude. WHY isolate: the ingest is a
  one-time content batch; keeping providers separate means the swap touches
  nothing else. Robustness: Gemini `responseSchema` (valid JSON for the large
  body) + 429/503 retry with backoff for the free-tier daily quota.
- **Explainer on Gemini.** DECISION (2026-07-25, Satyam's call — overrides the
  earlier "in-app AI stays Claude" note): the simulation explainer
  (`POST /ai/explain`) runs on the existing Gemini provider
  (`services/gemini.py` → `services/ai_explain.py`) because Gemini is the key
  we actually have; the placeholder Anthropic key meant the feature 503'd in
  practice. Returns structured JSON (summary / per-bottleneck WHY + fix /
  suggested fixes) via Gemini `responseSchema`. The case-study mentor stays on
  Claude (`services/claude.py`) — provider isolation means swapping either
  back is a one-import change. Full write-up: `docs/AI_INTEGRATION.md`.
- **Explainer + ingest on Groq.** DECISION (2026-07-26, Satyam's call —
  supersedes both Gemini notes above): the simulation explainer
  (`POST /ai/explain`) runs on Groq `llama-3.3-70b-versatile` and the roadmap
  ingest on Groq `qwen/qwen3.6-27b`, via a new isolated provider
  `services/groq.py` (OpenAI-compatible REST, no SDK, `GROQ_API_KEY` +
  `GROQ_MODEL`/`GROQ_INGEST_MODEL` env). WHY: the Groq key is the one with
  usable quota. Groq specifics baked into the provider: explicit User-Agent
  (Cloudflare 403s urllib's default), `retry-after`-aware 429 backoff, JSON
  *object* mode with the schema injected into the prompt (schema-enforced
  mode is GPT-OSS-only), `reasoning_effort: "none"` for qwen, and the ingest
  budgets `prompt + max_completion_tokens` under the 8k/min free-tier cap
  (413 is checked at request time and never retryable). Mentor stays on
  Claude; `services/gemini.py` kept for swap-back.
- **Diagrams are our own assets, never the source's.** Flowcharts render via
  **Mermaid** (```mermaid blocks → themed SVG, `components/ui/Mermaid.jsx`);
  static figures are hand-authored SVGs in `backend/static/roadmap/diagrams/`
  (served from `/static`). WHY not the source's `.excalidraw`: same copyright
  reason as the text. The ingest prompt requires Mermaid for flows, never ASCII.
- **All frontend network calls go through `frontend/src/api/`.** No `fetch`
  anywhere else. WHY: one place to add auth headers, base URLs, error handling.
- **Zustand is split into slices:** `canvas`, `simulation`, `ui`, `auth`.
  WHY: avoids one giant store; each screen touches only what it needs.
- **Backend routes are thin.** Business logic lives in `engine/` and
  `services/`. Routes parse input, call a service, shape the response.
- **AI calls are always context-scoped.** Graph state or case-study context is
  always in the prompt — never generic open-ended chat. WHY: relevant answers,
  predictable token cost, no "chatbot" drift.
- **Auth swap: self-hosted, not Supabase.** DECISION (2026-07-05): rolled our
  own auth on self-hosted Postgres instead of Supabase Auth + RLS. WHY: learning
  value + interview talking points (how real auth is built), and full control
  for AWS self-hosting later. Current implementation:
  - Password hashing: **bcrypt** (passlib) — `services/auth.py`.
  - Tokens: **HS256 JWT, access-token only**, 60-min expiry, `sub` = user id.
    No refresh token yet (planned). Sent as `Authorization: Bearer` header
    (not an httpOnly cookie yet — planned when the frontend wires in).
  - Schema: SQLAlchemy models (`users`, `designs`, `challenge_attempts`),
    Alembic migrations. UUID string PKs.
- **Ownership enforced in the app layer, not the DB.** With Supabase RLS gone,
  the "users touch only their own rows" guarantee now lives in FastAPI:
  `get_current_user` (`dependencies.py`) resolves the caller, and every
  `designs` / `challenge_attempts` query MUST filter by `user_id`. WHY this
  matters: forgetting the filter = a data leak that RLS used to catch for us.
  Every ownership-scoped route needs an explicit `user_id` check.
- **Canvas is optimistic.** UI updates instantly; the simulation result arrives
  async and reconciles.

NOTE: spec pins the AI model to `claude-sonnet-4-20250514`. A newer Sonnet
(`claude-sonnet-4-6`) is available as of 2026 — keep the model id in ONE place
(`backend/services/claude.py` / an env var) so it's a one-line change later.

---

## Ground rules for Claude Code in this repo

- **Engine rule lifted (2026-07-07):** Satyam explicitly asked Claude to build
  the full simulation engine to industry grade. It lives in `backend/engine/`
  with a design walkthrough in `backend/BACKEND_LOG.md` so Satyam can still own
  every line for interviews. Read that log before touching engine code.
- Match the existing folder structure; don't invent new top-level dirs.
- Keep components small and single-purpose. No god components.
- Don't add dependencies without flagging why; prefer the stack above.
- No secrets in code. Use `.env` (see `.env.example` files).
- Write code I can speak to in an interview — clarity over cleverness.

## How to give me good instructions (WHERE / WHAT / WHY)

Prompt shape that works best in this repo:
> WHERE: `frontend/src/components/canvas/` ·
> WHAT: add a custom React Flow node for the Cache component ·
> WHY: it needs a `hit_rate` field shown in the properties panel.

## Build phases

2 Wireframes ✅ · 3 Repo + CLAUDE.md ✅ · 4 Frontend canvas ✅ ·
5 Simulation engine ✅ · 6 Wire FE↔BE ✅ · 7 Case studies (curated JSON; scraper
ingest still stubbed) ✅ · 8 Challenges + scoring ✅ · 9 Auth + save + dashboard ✅ ·
10 AI features ✅ (needs ANTHROPIC_API_KEY) · **11 Polish + deploy (current)**

Big build 2026-07-07: sandbox canvas, challenge workspace + scoring, case-study
reader + "Simulate This", learn layer (`frontend/src/data/concepts.js`), auth
UI + dashboard, full engine + content + tests. All backend decisions are logged
in `backend/BACKEND_LOG.md` — keep appending there for backend work.

See `@docs/spec.md` for the full locked spec (schemas, component contracts,
failure modes, simulation output shape).
