# SystemSim

Interactive distributed-systems learning platform: design systems on a canvas,
simulate load to find bottlenecks, learn from real company case studies, and
practice scored challenges.

## Stack
React + Vite + React Flow + Zustand (frontend) · FastAPI + NetworkX (backend) ·
Supabase (Postgres + Auth) · Claude API (AI features + case-study ingestion).

## Run locally

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in keys
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env   # fill in keys
npm run dev            # http://localhost:5173
```

## Project memory
`CLAUDE.md` (root) holds project-wide rules; `frontend/CLAUDE.md` and
`backend/CLAUDE.md` hold component-specific conventions. Full spec in
`docs/spec.md`.

## Status
Phase 3 (repo bootstrap) complete. Next: Phase 4 frontend canvas, then Phase 5
simulation engine (written by hand).

> Note: `backend/engine/simulation.py` is intentionally left unimplemented —
> the simulation core is written by hand.
