# SystemSim — Project Memory

Interactive distributed-systems learning platform. Users visually design systems
on a canvas, simulate load to find bottlenecks, learn from real company case
studies, and practice scored challenges.

This file is read at the start of every Claude Code session. Keep it lean.
Component-specific rules live in `frontend/CLAUDE.md` and `backend/CLAUDE.md`
(loaded lazily when you work in those trees).

**Before debugging "why is X missing/empty," read `docs/INCIDENTS.md`.** It's
a short, append-only list of things that broke this project before —
including a database that went from 76 rows to entirely empty with the
cause never confirmed. Checking actual DB row counts before assuming a
route or frontend bug saves real time; this file exists because that
lesson was learned the hard way, more than once.

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
- DB/Auth: hosted Postgres (Neon) + custom FastAPI auth (SQLAlchemy + Alembic
  + JWT). DECISION (2026-07-29): dev and prod both point at Neon now (branch
  per dev — see "DB moved to Neon" under Decisions), not a local SQLite file
  — see `docs/INCIDENTS.md` #1 for why. `docker-compose.yml`'s local Postgres
  and the SQLite fallback in `db/session.py` both still exist as offline
  options, but Neon is what's actually used day to day. (Auth itself was
  swapped from Supabase — see "Auth swap" note under Decisions.)
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
- Hosting: **Cloudflare Pages** (frontend), **Google Cloud Run** (backend) —
  DECISION (2026-07-30, Satyam's call — supersedes the 2026-07-29 Fly.io note
  below, which was never deployed, and an earlier same-day "Vercel" draft of
  this same note that was never acted on): backend —
  `.github/workflows/deploy-backend.yml` builds the `backend/Dockerfile`
  image, pushes to Artifact Registry, runs `alembic upgrade head` against
  Neon in a one-off container, then deploys to Cloud Run — triggered on push
  to `main` touching `backend/**`. Frontend — Cloudflare Pages, connected
  directly to the GitHub repo (root directory `frontend`, build `npm run
  build`, output `dist`), no GitHub Actions workflow needed for it; SPA
  fallback via `frontend/public/_redirects` (`/* /index.html 200`) since
  the app uses React Router's `createBrowserRouter`. WHY Cloud Run: free-tier
  scale-to-zero fits this project's traffic, and GCP is already in play for
  embeddings (Gemini). WHY Cloudflare Pages: free tier, zero-config git
  integration, no cold starts for static assets. `fly.toml` is kept as a
  reference, not deleted, but is not what's live — see `docs/DEPLOYMENT.md`
  for the full GCP + Cloudflare Pages setup checklist (Artifact Registry,
  Secret Manager, service account/IAM, GitHub Actions secrets, Cloudflare
  Pages env vars). DB is Neon (see above), hosted independently of where the
  backend runs.
  - (superseded) Fly.io note, 2026-07-29: `fly.toml` + `Dockerfile` already
    exist, `release_command = alembic upgrade head` wired for auto-migration
    on deploy. Supersedes the earlier "AWS" plan, which was never acted on.

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
- **Roadmap ingest finished (2026-07-27):** all 76 lessons ingested via Groq
  qwen and published — 0 remaining, 65/76 carry a Mermaid diagram. The batch
  survived a daily-quota wall and a mid-run session interruption; the
  idempotent per-`day` upsert (not a longer retry loop) is why resuming was
  a no-op rather than a rebuild. Two lessons had ASCII diagrams slip past
  the ingest prompt's "always Mermaid" rule — fixed by hand via
  `scripts/convert_ascii_to_mermaid.py` (one became a table; no Mermaid type
  fits a bit-field layout). Full story + interview framing:
  `docs/AI_INTEGRATION.md` §5, `backend/BACKEND_LOG.md` (2026-07-27).
- **Mentor is RAG-grounded; retrieval is exact in-process search, no vector
  DB.** DECISION (2026-07-28): `POST /ai/mentor` retrieves top-4 chunks from
  the platform corpus (76 roadmap lessons + case studies, chunked into
  `rag_chunks` ~500 rows) and cites them (`sources` in the response, chips in
  the UI). Embeddings: Gemini `gemini-embedding-001` @ 768 dims
  (`services/embeddings.py` — Groq has no embeddings endpoint). Retrieval:
  exact cosine over an in-process numpy matrix (~1.5 MB) — a vector DB below
  ~50k chunks is cost without benefit; pgvector is the documented upgrade
  path, isolated behind `rag.retrieve()`. Generation: provider CHAIN
  Claude→Groq (supersedes "mentor stays on Claude" operationally — a live
  deploy can't 503 behind the placeholder Anthropic key; Claude auto-resumes
  as preferred when a real key lands). RAG failure degrades to the ungrounded
  prompt, never a 503. Index: `python -m services.rag_index build`,
  content-hash-diffed + idempotent. Full write-up: `docs/RAG.md`.
- **Floating global AI assistant, auth-gated; citations must be actually
  cited, not just retrieved.** DECISION (2026-07-29): `services/mentor.py`
  is now the shared grounded-generation core behind TWO surfaces —
  `POST /ai/mentor` (per-case-study widget, unchanged contract) and
  `POST /ai/chat` + `GET /ai/chat/history` (a floating chat bubble on every
  page, `FloatingChat.jsx`, context-aware: case study / sandbox graph+result
  / general). `/ai/chat` requires login — not a cosmetic restriction, it's
  the precondition for the DB-backed rate limit in `services/chat.py`
  (`ai_messages`, 20 msgs/10 min, `SELECT COUNT`, no Redis at this scale):
  an anonymous endpoint has no identity to count against. FIX (found live):
  `sources`/`grounded` used to reflect what retrieval found, not what the
  answer used — an off-topic question returned 4 irrelevant citation chips
  because their cosine scores barely cleared the noise floor; now filtered
  to only `[S#]` tags the model's own text actually references. Also fixed:
  the "Try it in the sandbox" boilerplate every lesson ends with was being
  chunked/cited despite carrying no explanatory content — excluded at chunk
  time. Full write-up: `docs/RAG.md` §3.5, §4.
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
  predictable token cost, no "chatbot" drift. One narrow, deliberate carve-out
  (2026-07-29, see the mentor/chat decision above): the assistant may answer
  from general knowledge, clearly labeled, but ONLY after retrieval finds
  nothing relevant in the platform corpus — the corpus is still checked
  first on every call, this isn't a route to unscoped chat.
- **DB moved to hosted Neon Postgres — dev included, not just prod.**
  DECISION (2026-07-29, Satyam's call): local dev's SQLite file had gone
  completely empty with the cause never confirmed (`docs/INCIDENTS.md` #1) —
  the second time this class of "silent local data loss" surfaced in the
  project's history. Rather than keep debugging a local file, dev now points
  at a Neon **`dev` branch** (child of the `production` branch, Neon's
  git-like data branching), so local work has real persistence without
  needing a teammate or a second machine to notice something vanished.
  `alembic upgrade head` must run against a fresh branch BEFORE the app ever
  starts (`main.py`'s `create_all` would otherwise create tables without
  stamping `alembic_version`, breaking future migrations — see
  `docs/INCIDENTS.md` #6 for the same class of mistake already made once).
  `db/session.py`'s SQLite fallback stays in the code (zero-config
  contributor bootstrapping, harmless when unused), but is not what runs day
  to day anymore. `services/roadmap_ingest.py` and friends now write
  directly to Neon via `DATABASE_URL` in `.env`. Hosting (Fly.io, see above)
  is a separate, deliberately deferred decision from this one.
- **Google OAuth — deferred, not decided against.** Satyam wants real
  outside users, not just a portfolio demo, so a password field is real
  signup friction worth removing. Not started: needs its own Google Cloud
  OAuth consent-screen setup (an external account step, same category as
  the Neon signup above) before any code changes. Would run ALONGSIDE the
  existing bcrypt+JWT auth (`services/auth.py`), not replace it — that auth
  is itself a documented interview talking point (see "Auth swap" below)
  and already works. Pick this up as its own task, not folded into
  unrelated work.
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
10 AI features ✅ (explainer + roadmap ingest live on Groq; mentor still
needs a real ANTHROPIC_API_KEY) · **11 Polish + deploy (current)**

Big build 2026-07-07: sandbox canvas, challenge workspace + scoring, case-study
reader + "Simulate This", learn layer (`frontend/src/data/concepts.js`), auth
UI + dashboard, full engine + content + tests. All backend decisions are logged
in `backend/BACKEND_LOG.md` — keep appending there for backend work.

See `@docs/spec.md` for the full locked spec (schemas, component contracts,
failure modes, simulation output shape).
