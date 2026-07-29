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
- `services/` — Claude API client, `auth.py` (bcrypt + JWT), scoring, ingestion.
  RAG: `rag.py` (chunk+retrieve), `embeddings.py` (Gemini), `rag_index.py`
  (build CLI), `mentor.py` (shared grounded-generation core: case_study /
  sandbox / general context modes), `chat.py` (`/ai/chat`-only: persistence +
  DB-backed rate limit on top of `mentor.py`) — see `docs/RAG.md`.
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
- Claude API model id lives in ONE place (`services/claude.py`, from env).
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
