# Deployment — Cloud Run (backend) + Vercel (frontend)

DECISION (2026-07-30): backend hosts on **Google Cloud Run**, frontend on
**Vercel**, DB stays on Neon (already true in dev — see CLAUDE.md). The CI
pipeline (`.github/workflows/deploy-backend.yml`) already exists and does
build → migrate → deploy on every push to `main` that touches `backend/**`.
This doc is the one-time GCP setup that pipeline assumes exists, plus the
Vercel side, written for a from-scratch GCP account (no project yet).

Do these in order — Vercel needs the Cloud Run URL, and Cloud Run's CORS
needs the Vercel URL, so there's one unavoidable "come back and fix CORS"
step near the end.

---

## 0. Prerequisites

- Install the [gcloud CLI](https://cloud.google.com/sdk/docs/install), then:
  ```bash
  gcloud auth login
  ```
- A GCP **billing account** (Cloud Run/Artifact Registry/Secret Manager have
  free tiers, but a project needs billing enabled to use them at all).

## 1. Create the GCP project

```bash
gcloud projects create systemsim-prod --name="SystemSim"
gcloud config set project systemsim-prod
gcloud billing projects link systemsim-prod --billing-account=YOUR_BILLING_ACCOUNT_ID
```

Enable the APIs the pipeline needs:

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  iamcredentials.googleapis.com
```

## 2. Artifact Registry (Docker image storage)

Must match `REGION`/`REPO` in the workflow (`us-central1` / `systemsim`):

```bash
gcloud artifacts repositories create systemsim \
  --repository-format=docker \
  --location=us-central1 \
  --description="SystemSim backend images"
```

## 3. Service account for GitHub Actions to deploy as

```bash
gcloud iam service-accounts create systemsim-deployer \
  --display-name="SystemSim CI deployer"

PROJECT_ID=$(gcloud config get-value project)
SA="systemsim-deployer@${PROJECT_ID}.iam.gserviceaccount.com"

for role in roles/run.admin roles/artifactregistry.writer roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA}" --role="$role"
done

# JSON key for the GCP_SA_KEY GitHub secret (step 5)
gcloud iam service-accounts keys create systemsim-deployer-key.json --iam-account="$SA"
```

Treat `systemsim-deployer-key.json` as a secret: paste its contents into the
GitHub secret in step 5, then delete the local file. Don't commit it.

## 4. Secret Manager — the actual runtime secrets

Create each secret with a real value (replace placeholders):

```bash
echo -n "postgresql://...@...neon.tech/neondb?sslmode=require" | \
  gcloud secrets create DATABASE_URL --data-file=-
echo -n "$(openssl rand -hex 32)" | gcloud secrets create JWT_SECRET --data-file=-
echo -n "your-gemini-key"    | gcloud secrets create GEMINI_API_KEY --data-file=-
echo -n "your-groq-key"      | gcloud secrets create GROQ_API_KEY --data-file=-
echo -n "your-anthropic-key" | gcloud secrets create ANTHROPIC_API_KEY --data-file=-
```

**Common gotcha:** creating the secret is not enough — Cloud Run reads
secrets using its own **runtime** service account (the deploy SA from step 3
only needs permission to *deploy*, not to *read secrets at runtime*). Grant
access to whichever SA the Cloud Run service actually runs as — by default
that's the project's compute default SA:

```bash
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

for secret in DATABASE_URL JWT_SECRET GEMINI_API_KEY GROQ_API_KEY ANTHROPIC_API_KEY; do
  gcloud secrets add-iam-policy-binding "$secret" \
    --member="serviceAccount:${RUNTIME_SA}" --role="roles/secretmanager.secretAccessor"
done
```

Skip this and the first deploy will succeed, but every request will 500 with
a permission-denied reading the secret — a classic Cloud Run first-deploy trap.

## 5. GitHub Actions secrets

Repo → Settings → Secrets and variables → Actions. Add:

| Secret | Value |
|---|---|
| `GCP_SA_KEY` | full contents of `systemsim-deployer-key.json` |
| `GCP_PROJECT_ID` | `systemsim-prod` (or whatever you named it) |
| `DATABASE_URL` | same Neon connection string as the Secret Manager one — used directly by the migration step, which runs the image as a one-off container rather than reading Secret Manager |
| `CORS_ORIGINS` | placeholder for now, e.g. `http://localhost:5173` — comes back in step 8 |

## 6. First backend deploy

Merge this branch to `main` (the workflow only triggers on `main`, path
`backend/**`). Watch the Actions run; on success, get the URL:

```bash
gcloud run services describe systemsim-api --region=us-central1 --format='value(status.url)'
```

Sanity check:

```bash
curl https://YOUR-CLOUD-RUN-URL/health
```

## 7. Frontend on Vercel

1. Import the repo in Vercel, set **Root Directory** to `frontend`.
2. Framework preset: Vite (auto-detected).
3. Add env var `VITE_API_URL` = the Cloud Run URL from step 6.
4. Deploy. `frontend/vercel.json` (added in this branch) handles the SPA
   rewrite so client-side routes (e.g. `/roadmap/some-lesson`) don't 404 on
   a hard refresh — this is the #1 thing people forget with React Router +
   Vercel and a Vite project.

## 8. Close the CORS loop

Now that you have the real Vercel URL, update the `CORS_ORIGINS` GitHub
secret to the actual frontend origin (comma-separate if you also want
previews/localhost, e.g. `https://systemsim.vercel.app,http://localhost:5173`),
then re-run the backend workflow (push any change under `backend/**`, or
re-run the last successful Action) so Cloud Run picks it up.

## 9. Post-deploy smoke test

- `GET /health` → `{"status": "ok"}`
- Sign up / log in from the deployed frontend (exercises DB + JWT)
- Open a roadmap lesson, refresh the page directly on that URL (exercises
  the Vercel SPA rewrite)
- Run a sandbox simulation and click "Explain" (exercises Groq — check Cloud
  Run logs if it's slow; see the timeout note below)
- Open a case study and ask the mentor a question (exercises Claude + RAG)

---

## Known risk, deliberately not changed here

`services/groq.py`'s retry/backoff can block a single live request (not just
the batch ingest) for several minutes during a Groq 429 storm. The Cloud Run
deploy now sets `--timeout=600` (see the workflow) to give it room past the
platform's 300s default — but a sustained Groq outage will still make
`/ai/explain` and `/ai/mentor` (Groq-backed path) slow rather than fast-fail.
Not fixed further here since it's a retry-policy tradeoff (ingest wants
patient retries; a live request arguably wants a tighter cap) rather than a
deployment bug — worth a follow-up if it's noticed in practice.

## Reference: general web-app deploy pitfalls checked against this repo

| Pitfall | Status in this project |
|---|---|
| Secrets committed to git | Clean — `.env` gitignored, nothing tracked |
| App silently falls back to local SQLite/dev config in prod | Fixed — `db/session.py` and `services/auth.py` fail hard when `ENVIRONMENT=production` and the real value is missing |
| Hardcoded `localhost` API URLs in frontend | Clean — all calls go through `VITE_API_URL` in `api/client.js` |
| CORS misconfigured or wildcarded | Env-driven via `CORS_ORIGINS`, needs the real Vercel URL (step 8) |
| Container doesn't respect `$PORT` | Handled — Dockerfile CMD uses `${PORT}`, defaults to 8080 |
| SPA client-side routes 404 on refresh | Fixed in this branch — `frontend/vercel.json` rewrite |
| Gitignored file the app depends on at runtime | Already bit this project once (`docs/INCIDENTS.md` #8, static roadmap diagrams) — fixed by moving to inline Mermaid, not a live risk anymore |
| DB connection pool exhaustion against a serverless Postgres | Using Neon's pooled endpoint + `pool_pre_ping=True` already |
| Migrations not run automatically on deploy | Handled — workflow runs `alembic upgrade head` in a one-off container before deploying |
| Secret created but runtime service account can't read it | Real trap for a from-scratch GCP setup — covered in step 4 above |
| Long-running request exceeding platform timeout | Groq retry path — mitigated with `--timeout=600`, see risk note above |
