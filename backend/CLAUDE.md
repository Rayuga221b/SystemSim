# Backend — conventions

FastAPI + Python. Loaded when working in `backend/`.

## Layout

- `main.py` — app entry, CORS, router registration only. No business logic.
- `routes/` — thin. Parse request → call service/engine → shape response.
  - `simulate.py` → POST `/simulate`
  - `challenges.py` → GET `/challenges`, POST `/challenges/{id}/attempt`
  - `designs.py` → CRUD `/designs`
  - `casestudies.py` → GET `/casestudies`, GET `/casestudies/{slug}`
  - `ai.py` → POST `/ai/explain`, POST `/ai/mentor`
  - `admin.py` → POST `/admin/ingest`
- `engine/simulation.py` — the SimulationEngine. **Satyam writes this by hand.**
- `services/` — Claude API client, `auth.py` (bcrypt + JWT), scoring, ingestion.
- `db/` — SQLAlchemy `base.py` + `session.py` (engine, `get_db`). `alembic/` for
  migrations. `models/` — `user`, `design`, `challenge_attempt`.
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
