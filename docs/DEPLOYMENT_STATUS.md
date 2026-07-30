# Deployment status — live tracker

**Read this first in any new session touching deployment.** Unlike
`docs/DEPLOYMENT.md` (the how-to checklist, written once) and
`backend/BACKEND_LOG.md` (append-only history), this file is a **living
snapshot** — overwrite sections as state changes, don't append. Last updated:
2026-07-30.

---

## Backend — ✅ LIVE on Google Cloud Run

**URL:** `https://systemsim-api-kicddhkfiq-uc.a.run.app`

```bash
curl https://systemsim-api-kicddhkfiq-uc.a.run.app/health
# {"status":"ok"}
```

Deploys automatically on every push to `main` that touches `backend/**`
(`.github/workflows/deploy-backend.yml`): build → push to Artifact Registry
→ `alembic upgrade head` against `DATABASE_URL` → deploy to Cloud Run.

### GCP resources (project `systemsim-504004`, project number `203601614528`)

| Resource | Value |
|---|---|
| Region | `us-central1` |
| Artifact Registry repo | `systemsim` |
| Cloud Run service | `systemsim-api` |
| Deploy service account | `systemsim-deployer@systemsim-504004.iam.gserviceaccount.com` — roles: `run.admin`, `artifactregistry.writer`, `iam.serviceAccountUser` |
| Runtime service account | `203601614528-compute@developer.gserviceaccount.com` (default compute SA — Cloud Run reads secrets as this identity, NOT the deploy SA) |
| Secret Manager secrets | `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `GROQ_API_KEY` — all granted `secretmanager.secretAccessor` to the runtime SA above. **No `ANTHROPIC_API_KEY`** — Anthropic dropped entirely (2026-07-30 decision, see CLAUDE.md) |

### GitHub Actions secrets (repo Settings → Secrets → Actions)

| Secret | Status |
|---|---|
| `GCP_SA_KEY` | Set (rotated once — see incident log below) |
| `GCP_PROJECT_ID` | Set: `systemsim-504004` |
| `DATABASE_URL` | Set — Neon **`production`** branch, pooled connection string |
| `CORS_ORIGINS` | ⚠️ **Still the placeholder** `http://localhost:5173` — MUST update once the frontend has a real Cloudflare Pages URL (see below), then re-run the workflow |

### Database — Neon, two branches

- **`production`** branch = what the deployed backend actually uses (`DATABASE_URL` above). Schema migrated via Alembic (not `create_all` — see `docs/INCIDENTS.md` #6 for why that matters). Currently has:
  - `roadmap_lessons`: **62 published rows** (synced from `dev` via `psql \copy` — see below)
  - `rag_chunks`: **0 rows** — RAG index has never been built against either branch. Mentor/chat will answer via Groq but with no citations until this is built.
  - `users` / `designs` / `challenge_attempts` / `ai_messages`: empty (correct — production should only ever hold real accounts, never dev test data)
- **`dev`** branch = local development only (`backend/.env`). Has the full in-progress roadmap ingest (62/76 lessons as of this writing, more being ingested).

### Content publishing workflow (decided this session, not yet fully adopted)

Going forward, **ingest directly into `production`**, not `dev` — avoids the
manual `dev → production` copy step entirely:

```bash
DATABASE_URL="PRODUCTION_CONNECTION_STRING" python -m services.roadmap_ingest --days <N>
# review, then:
DATABASE_URL="PRODUCTION_CONNECTION_STRING" python -m services.roadmap_ingest --days <N> --publish
```

New lessons land as drafts (`published=false`, invisible to the public API)
until explicitly `--publish`ed — no staging database needed, the schema
already has a draft/live flag (`RoadmapLesson.published`, filtered on by
every public route in `services/roadmap.py`). The moment a row flips to
published, it's live on the deployed backend immediately — no redeploy.

The one-time backlog copy (already-ingested `dev` content → `production`)
used `psql \copy`, NOT `pg_dump` (see incident log — version mismatch).

---

## Frontend — ❌ NOT YET DEPLOYED

Plan: Cloudflare Pages, native git integration (no GitHub Actions workflow
needed for it). Not started this session — backend/GCP work took priority.

Prep already done in the repo:
- `frontend/public/_redirects` (`/* /index.html 200`) — SPA fallback for
  React Router's `createBrowserRouter`, ships automatically with any
  Cloudflare Pages build since `public/` copies to the build output root.

**Remaining steps** (full detail in `docs/DEPLOYMENT.md` §7):
1. Cloudflare dashboard → Workers & Pages → connect this GitHub repo
2. Root directory `frontend`, build `npm run build`, output `dist`
3. Env var `VITE_API_URL` = `https://systemsim-api-kicddhkfiq-uc.a.run.app`
4. Deploy → get the `*.pages.dev` URL
5. Update the `CORS_ORIGINS` GitHub secret to that URL, re-run the backend
   deploy workflow so Cloud Run picks it up

---

## Open items, in priority order

1. **Deploy frontend to Cloudflare Pages** (above) — nothing else works
   end-to-end for a real user until this + the CORS update happen
2. **Finish today's roadmap ingestion** (~14 lessons remaining as of this
   writing) — ingest directly to `production` per the workflow above
3. **Build the RAG index** once ingestion settles: `python -m
   services.rag_index build` against `production` — without this, mentor/chat
   citations stay empty (answers still work, just ungrounded)
4. **Update `CORS_ORIGINS`** GitHub secret + redeploy, once frontend URL exists

---

## Incidents hit during this deployment (for the next session's context)

- **A GCP service-account JSON key was pasted into chat mid-setup.** Rotated
  immediately (`gcloud iam service-accounts keys delete` + reissue), replacement
  pasted directly into GitHub's secret UI instead. No downstream exposure.
- **`GCP_PROJECT_ID` GitHub secret was initially missing**, causing the image
  tag to build as `us-central1-docker.pkg.dev//systemsim/...` (double
  slash, empty project segment) → `invalid reference format`. Added the secret,
  re-ran.
- **`roles/artifactregistry.writer` silently didn't land** on the
  `systemsim-deployer` service account despite being in the same
  `add-iam-policy-binding` loop as the two roles that did land (`run.admin`,
  `iam.serviceAccountUser`) — cause not confirmed, just re-granted manually.
  **If setting this up again, verify all three roles actually show up** in
  `gcloud projects get-iam-policy` rather than trusting the loop ran clean.
- **`pg_dump` refused to run**: Cloud Shell's client is Postgres 16, Neon's
  server is Postgres 18 — `pg_dump` refuses to dump from a newer major
  version by design. Fix: use `psql -c "\copy ... TO/FROM 'file.csv' WITH
  CSV HEADER"` instead — far more version-tolerant since it's just
  `SELECT`/`INSERT` under the hood, not `pg_dump`'s binary format logic.
- **Both `pg_dump`/`psql \copy` operations need the DIRECT (unpooled)
  connection string**, not the pooled (`-pooler` hostname) one used for the
  app itself — applies to both `dev` (source) and `production` (target).
- **First `\copy ... TO` attempt exported 0 rows** — wrong connection string
  used for "dev" (likely reused the production string by mistake). Fixed by
  pulling the known-good dev string directly from local `backend/.env`
  rather than re-navigating the Neon console.

---

## Related docs

- `docs/DEPLOYMENT.md` — the how-to checklist (provisioning steps, written
  once, use for setting this up in a NEW GCP project)
- `backend/BACKEND_LOG.md` — dated design/decision log (append-only,
  chronological "why" for each architecture choice)
- `docs/INCIDENTS.md` — cross-project gotchas already hit (DB, migrations,
  scripts) — not deployment-specific, broader scope than this file
- `CLAUDE.md` — top-level project memory, Decisions section has the dated
  hosting/AI-provider decisions this status reflects
