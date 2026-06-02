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
- DB/Auth: Supabase (Postgres + Auth, RLS on)
- AI: Claude API — model `claude-sonnet-4-20250514` (see NOTE under Decisions)
- Hosting: Vercel (frontend), Render (backend)

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
- **All frontend network calls go through `frontend/src/api/`.** No `fetch`
  anywhere else. WHY: one place to add auth headers, base URLs, error handling.
- **Zustand is split into slices:** `canvas`, `simulation`, `ui`, `auth`.
  WHY: avoids one giant store; each screen touches only what it needs.
- **Backend routes are thin.** Business logic lives in `engine/` and
  `services/`. Routes parse input, call a service, shape the response.
- **AI calls are always context-scoped.** Graph state or case-study context is
  always in the prompt — never generic open-ended chat. WHY: relevant answers,
  predictable token cost, no "chatbot" drift.
- **Supabase RLS enabled.** Users read/write only their own `designs` and
  `challenge_attempts`.
- **Canvas is optimistic.** UI updates instantly; the simulation result arrives
  async and reconciles.

NOTE: spec pins the AI model to `claude-sonnet-4-20250514`. A newer Sonnet
(`claude-sonnet-4-6`) is available as of 2026 — keep the model id in ONE place
(`backend/services/claude.py` / an env var) so it's a one-line change later.

---

## Ground rules for Claude Code in this repo

- **DO NOT implement `backend/engine/simulation.py`.** Satyam writes the
  simulation engine core by hand (interview credibility). You may scaffold the
  interface, write tests, and review — but do not fill in the traversal or the
  per-component strategy logic unless explicitly asked.
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

2 Wireframes ✅ · **3 Repo + CLAUDE.md (current)** · 4 Frontend canvas ·
5 Simulation engine *(Satyam writes)* · 6 Wire FE↔BE · 7 Case studies + ingest ·
8 Challenges + scoring · 9 Auth + save + dashboard · 10 AI features · 11 Polish + deploy

See `@docs/spec.md` for the full locked spec (schemas, component contracts,
failure modes, simulation output shape).
