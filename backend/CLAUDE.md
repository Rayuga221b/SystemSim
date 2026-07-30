# Backend — conventions

FastAPI + Python. Loaded when working in `backend/`.

See `docs/INCIDENTS.md` for gotchas already hit in this backend (silent
wrong-DB scripts, migration/`create_all` races, a database that went
entirely empty) — check it before assuming new, unrelated behavior.

## Layout

- `main.py` — app entry, CORS, router registration only. No business logic.
- `routes/` — thin. Parse request → call service/engine → shape response.
  - `simulate.py` → POST `/simulate`
  - `challenges.py` → GET `/challenges`, POST `/challenges/{id}/attempt`
  - `designs.py` → CRUD `/designs`
  - `casestudies.py` → GET `/casestudies`, GET `/casestudies/{slug}`
  - `ai.py` → POST `/ai/explain`, POST `/ai/mentor`, POST `/ai/chat` (auth
    required), GET `/ai/chat/history` (auth required)
  - `admin.py` → POST `/admin/ingest`
- `engine/simulation.py` — the SimulationEngine. **Satyam writes this by hand.**
- `services/` — `groq.py` (Groq API client: explain/ingest/mentor models),
  `auth.py` (bcrypt + JWT), scoring, ingestion. RAG: `rag.py`
  (chunk+retrieve), `embeddings.py` (Gemini), `rag_index.py` (build CLI),
  `mentor.py` (shared grounded-generation core: case_study / sandbox /
  general context modes), `chat.py` (`/ai/chat`-only: persistence +
  DB-backed rate limit on top of `mentor.py`) — see `docs/RAG.md`. No
  Anthropic dependency (dropped 2026-07-30 — all generation is Groq now).
- `db/` — SQLAlchemy `base.py` + `session.py` (engine, `get_db`). `DATABASE_URL`
  is a hosted Neon Postgres branch (dev branch for local work) — see `.env`;
  the SQLite fallback in `session.py` only kicks in when `DATABASE_URL` is
  unset. `alembic/` for migrations. `models/` — `user`, `design`,
  `challenge_attempt`, `roadmap_lesson`, `rag_chunk`, `ai_message`.
- `dependencies.py` — `get_current_user` (Bearer JWT → User). Ownership-scoped
  routes MUST filter queries by the resolved `user_id` (no RLS backstop).
- `data/` — `challenges.json`, `seed_urls.json`.

## Rules

- **Never auto-implement `engine/simulation.py`.** Scaffold interface + tests
  only unless explicitly asked. This is the interview-credibility core.
- Strategy pattern for components: each type is a class with
  `process(load_rps) -> (output_rps, status)`. Same interface for all.
- Simulation is stateless — no globals, no session. Graph in, result out.
- Pydantic models for every request/response; mirror `docs/spec.md` schema.
- Groq model ids live in ONE place (`services/groq.py`, from env:
  `GROQ_MODEL` / `GROQ_INGEST_MODEL` / `GROQ_MENTOR_MODEL`).
- AI prompts are always context-scoped (graph or case study in the prompt).
- Use NetworkX for the graph; BFS traversal from the Client node.
- Keep routes ≤ ~30 lines; push logic down.
- **Any standalone script (`python -m scripts.x` / `python -m services.x`)
  that touches the DB must call `load_dotenv()` at the top, before importing
  `db.session`.** `main.py` loads `.env` on app startup; a bare script does
  not get that for free, and `db/session.py` reads `DATABASE_URL` at import
  time with a silent SQLite fallback if unset — no crash, just the wrong
  database. See `docs/INCIDENTS.md` #3 (this exact bug already happened).
- **Never let `create_all` be the first thing to touch a fresh database.**
  Run `alembic upgrade head` against a new DB before ever starting the app —
  otherwise tables get created without `alembic_version` being stamped, and
  every later migration fails on "table already exists." See
  `docs/INCIDENTS.md` #6.

## Roadmap ingestion (DECISION 2026-07-30 — read before running `roadmap_ingest`)

Ingest **directly against `production`'s `DATABASE_URL`**, not `dev`. Full
rationale + incident history: `docs/DEPLOYMENT_STATUS.md` §"Content
publishing workflow" (that file is the canonical, up-to-date version of
this section — check it first, this is a summary):

```bash
DATABASE_URL="PRODUCTION_CONNECTION_STRING" python -m services.roadmap_ingest --days <N>
```

(the inline `DATABASE_URL=` on the command line takes precedence over
whatever `load_dotenv()` sets from `.env`, since `python-dotenv` never
overrides an already-set env var — safe to use this pattern without
touching `.env` at all)

- New lessons land as **drafts** (`published=false`) — invisible to every
  public route (`services/roadmap.py` filters `WHERE published = true`).
- **`ingest_days()` always calls the AI provider, every time, for every
  day passed — there is no cheap "just publish what's already there"
  built into `--publish`.** Running the same day twice (once plain, once
  with `--publish`) burns the Groq/Gemini call twice, and can produce a
  *different* result the second time (generation isn't deterministic).
- To review before publishing: run once WITHOUT `--publish`, inspect via
  `psql "PRODUCTION_DIRECT_STRING" -c "SELECT day, slug, title, published
  FROM roadmap_lessons WHERE day = <N>;"`, then publish for free with SQL —
  `UPDATE roadmap_lessons SET published = true WHERE day IN (...);` — never
  by re-running ingestion.
- To skip review (content you already trust): pass `--publish` on the one
  and only ingestion call.
- Any bulk SQL against Neon (the `psql` calls above, or `pg_dump`) needs
  the DIRECT (unpooled, no `-pooler` in hostname) connection string — the
  app's own pooled string works for normal queries but not always for
  admin-style operations.
