# Incidents & Gotchas — read this before you assume something is broken

This is **not** a build log (that's `backend/BACKEND_LOG.md`, which explains
what was built and why). This file is the opposite angle: things that broke,
confused a session, or nearly caused the same mistake twice — kept separate
so a future Claude instance can scan one short file instead of combing a
700-line design log for "wait, has this happened before?"

Append new entries at the bottom, oldest first. Mark status honestly —
**Unresolved** is a valid status. Don't retroactively claim a cause was
confirmed if it wasn't.

## Quick reference

| # | What happened | Status |
|---|---|---|
| 1 | Local dev SQLite DB went from 76 lessons to entirely empty (all 6 tables) | **Unresolved cause** — data unrecoverable, worked around by moving to Neon |
| 2 | Background ingest processes died silently mid-run, twice | Fixed (use `nohup ... & disown`, not the harness's background flag alone) |
| 3 | A migration script silently wrote to the wrong DB | Fixed (missing `load_dotenv()`) |
| 4 | Neon free-tier child branches auto-delete after 24h by default | Fixed (disable expiry before treating a branch as permanent) |
| 9 | A long AI-provider retry wait let the Neon connection go stale, crashing the whole ingest batch on `rollback()` | Fixed (`pool_pre_ping=True` + a hardened rollback handler) |
| 5 | Multiple concurrent Claude Code sessions on this repo produce confusing symptoms | Not a bug — awareness only |
| 6 | `alembic upgrade` on a DB that already has the schema fails; `stamp` is the fix | Fixed, see BACKEND_LOG 2026-07-28 |
| 7 | SQLite silently drops tzinfo on read even from timezone-aware columns; Postgres doesn't | Fixed, see BACKEND_LOG 2026-07-29 |
| 8 | 7 roadmap lessons depended on static SVGs that were never committed anywhere | Fixed, see BACKEND_LOG 2026-07-29 |

---

## 1. Local dev database emptied — root cause never confirmed

**What happened:** on 2026-07-28, right after retrofitting Alembic, the log
confirms `roadmap_lessons` still had 76 rows after `alembic stamp head`
("Confirmed after: still 76 rows in `roadmap_lessons`, untouched" —
BACKEND_LOG 2026-07-28). By the next time anyone checked (later the same
day, per the diagram-audit entry, and independently confirmed again in a
separate session on 2026-07-29), `backend/systemsim.db` had **zero rows in
every table** — `users`, `designs`, `challenge_attempts`, `roadmap_lessons`,
`rag_chunks`, `ai_messages`. Not "the roadmap table specifically" — the
entire database.

**Status: unresolved.** No one caught the moment it happened, so there's no
confirmed mechanism. The file's mtime (`Jul 28 17:48`) lands inside the same
day's RAG/migration work, which independently logged a *related* but
distinct race (`create_all` from a `--reload` dev server racing
`alembic upgrade` on the `rag_chunks` table, resolved with `stamp` — see
BACKEND_LOG 2026-07-28 "Lesson 2"). That's circumstantial, not proof — it's
plausible something in that same window (a fresh `create_all` against a
*different* file path, a manual delete, a test run pointed at the wrong
`DATABASE_URL`) is responsible, but nothing pins it down. **Don't state this
as solved in future entries unless someone actually reproduces it.**

**What did NOT cause it (ruled out):** the test suite uses a separate
`test_systemsim.db` file, confirmed to exist independently — tests running
don't explain the dev file emptying.

**Recovery:** local SQLite data was gone with nothing to restore from (no
backups of a gitignored dev file — that's expected for a throwaway local
store, which is exactly the point below). Roadmap lessons were re-ingested
from scratch (`scripts/seed_roadmap.py` for the 7 free hand-authored days,
`services.roadmap_ingest` via Groq for the rest — no new source data needed,
`data/roadmap_source_cache/` had survived since it's a separate gitignored
directory untouched by the DB reset). Users/designs/challenge_attempts had
nothing to recover — real account data with no source of truth other than
the DB itself.

**The actual fix — don't rely on a local file at all.** DECISION
(2026-07-29): moved dev + prod to a hosted Neon Postgres project (branch per
dev, see BACKEND_LOG "Neon Postgres migration" entry). A local SQLite file
on one machine was always a single point of failure for exactly this kind
of silent, unwitnessed loss — hosted Postgres doesn't fix "something can
still delete rows," but it does fix "a file quietly vanishes with no one
watching and no way to know when." `db/session.py`'s SQLite fallback stays
in the code for zero-config contributor bootstrapping; it is not what
actually gets used day to day anymore.

**Lesson for future instances:** when something seems "missing" (a page
empty, a feature not returning content), check row counts in the actual
database directly (`SELECT COUNT(*) FROM <table>`) before assuming the
route, the frontend, or your own recent change is the bug. This cost real
time twice in this project's history — once here, once independently by a
different session investigating the diagram issue — because the instinct
both times was to debug the *feature* before verifying the *data existed*.

## 2. Background ingest processes died silently, twice

**What happened:** two separate long-running `roadmap_ingest` batches,
launched via the harness's `run_in_background: true` on the Bash tool,
stopped producing output mid-run with no `[FAIL]` line, no `Done:` summary,
and no process left in `pgrep -fl roadmap_ingest`. One coincided with a
Claude Code session itself ending; the other had no obvious trigger.

**Status: fixed**, for this project's usage pattern. `run_in_background`
alone does not guarantee a child process survives if the shell/session
context that spawned it tears down. Switched to launching with
`nohup <cmd> > logfile 2>&1 & disown`, which fully detaches the process from
the parent shell — confirmed to survive across the rest of that session.

**Lesson for future instances:** for any batch expected to run longer than
one turn or possibly outlive the current session, use `nohup ... & disown`
with output redirected to a real file, not just the harness's background
flag. Verify liveness with `pgrep -fl <name>`, not by assuming a lack of a
"finished" notification means "still running" — check the process table
directly. Treat an ambiguous "stopped, may have been running when the
process exited" status as inconclusive; verify against the actual persisted
state (a DB row count, in this project's case), not the process
supervisor's status string.

## 3. A migration script silently wrote to the wrong database

**What happened:** `scripts/copy_roadmap_to_neon.py` (written to copy
ingested rows from local SQLite into the newly-created Neon branch) reported
"Copied 11 lesson(s) into Neon" — but a follow-up query against Neon showed
0 rows. The script had re-copied SQLite rows back into the same SQLite file.

**Root cause:** `db/session.py` reads `DATABASE_URL` from the process
environment at import time with no fallback to load `.env` itself — only
`main.py` (the FastAPI app) calls `load_dotenv()` on startup.
`services/roadmap_ingest.py` already knows this and calls `load_dotenv()`
explicitly at the top of the file for exactly this reason (its own comment:
"Standalone script... unlike main.py, nothing else loads backend/.env
here"). The new script skipped this and silently got the SQLite fallback
instead of an error.

**Status: fixed.** Added `load_dotenv()` before importing `db.session` in
the script; re-ran, confirmed real rows in Neon this time.

**Lesson for future instances:** any new standalone script under
`backend/scripts/` or run via `python -m services.x` that touches the
database MUST call `load_dotenv()` at the very top, before importing
anything that reads env vars at import time (`db.session`, the AI provider
modules that read API keys at module load). This fails *silently* — no
crash, no traceback, just the wrong target — which is worse than an error.
Grep for `load_dotenv` in an existing standalone script
(`services/roadmap_ingest.py`) before writing a new one.

## 4. Neon free-tier child branches auto-delete after 24 hours by default

**What happened:** immediately after creating the `dev` branch (child of
`production`) in the Neon console, its overview page showed "This branch
will be automatically deleted on [+24h]" — a default TTL on non-primary
branches to manage free-tier usage. Caught before any schema or data work
happened, by reading the branch page carefully.

**Status: fixed** — disabled via "Edit Expiration" in the branch overview
before proceeding. Would otherwise have reproduced incident #1 verbatim, one
day later, with Neon instead of SQLite as the vanishing store.

**Lesson for future instances:** any time a new Neon (or similar
free-tier-with-ephemeral-defaults) branch/project is created for this
project, check for an auto-expiry setting before treating it as permanent
storage. Don't assume "I created it in a dashboard" means "it persists."

## 5. Multiple concurrent Claude Code sessions on this repo — awareness, not a bug

**What happened:** across one conversation, files changed that weren't
touched by that session (`CLAUDE.md` gained RAG/mentor content, new commits
appeared in `git log`, PRs merged without that session merging them, a
live "N lines changed" indicator swung from +4145 to 934 unprompted).

**Status: not a bug.** This project has had multiple Claude Code sessions
running against the same working directory concurrently (confirmed:
BACKEND_LOG's 2026-07-28/07-29 RAG and diagram-fix entries were written by
a session other than the one that wrote this file). Symptoms of this look
exactly like "something broke" if you don't consider it: unexplained file
diffs, docs that don't match your last read of them, git history with
commits you didn't make.

**Lesson for future instances:** if you observe a file changed that you
didn't touch, or content in a doc you don't remember writing, consider
"another session is active" as a real hypothesis before assuming a bug or
your own error. Re-read files fresh before editing rather than trusting an
earlier read from the same conversation if meaningful time has passed —
this project's actual convention (append-only logs, specific `git add` of
only the files you intend to touch, never `git add -A`) exists partly
*because* of this risk.

## 6–8. Cross-referenced from BACKEND_LOG.md (not duplicated here)

These are fully written up elsewhere; short pointers only, so this file
stays the single "have I hit this before?" scan without rotting out of sync
with the fuller version:

- **`alembic upgrade` fails on a DB that already has the schema (`create_all`
  got there first) — `alembic stamp head` is the reconciliation tool, not a
  retry.** Hit twice in one day (the initial Alembic retrofit, and again
  when a `--reload` dev server raced a new migration). Full detail:
  BACKEND_LOG.md, 2026-07-28 "Retrofitted Alembic" and "RAG" entries.
- **SQLite silently drops tzinfo on read, even from a
  `DateTime(timezone=True)` column; Postgres round-trips it correctly.**
  Broke a rate-limit's datetime subtraction. Relevant anywhere this
  schema's timestamps get arithmetic done on them. Full detail:
  BACKEND_LOG.md, 2026-07-29 "Two RAG bugs" entry, lesson 1.
- **7 roadmap lessons referenced hand-authored SVGs under a gitignored
  static directory that no longer existed anywhere** (the environment that
  authored them was gone). Fixed by converting to inline Mermaid — same
  fix already proven for the ASCII-diagram incident (BACKEND_LOG
  2026-07-27). General lesson: anything gitignored as a "build artifact"
  that a *feature* actually depends on at runtime is one clean-checkout
  away from silently missing; prefer content that travels with the DB row
  (text) over a sibling file on disk.

## 9. Long AI-provider retries let the Neon connection go stale, crashing the batch

**What happened:** twice during the post-migration roadmap re-ingest, the
whole batch process crashed outright (not a per-day `[FAIL]`, the entire
`python -m services.roadmap_ingest` process died) partway through a run
that had real, expensive AI-provider quota already spent on lessons still
in flight. Both times, the crash landed right after a day whose Groq call
had to wait out a long rate-limit backoff (7–14 minutes, reported via
`retry-after`).

**Root cause:** `services/roadmap_ingest.py` holds one SQLAlchemy session
open for the whole batch. Neon (like most hosted Postgres) closes
connections that sit idle past some threshold. A multi-minute wait inside
one day's AI call was long enough for that to happen. The per-day handler
already catches the AI failure fine (`except Exception: db.rollback()`) —
but `db.rollback()` itself, called on an already-dead connection, raises
`psycopg2.OperationalError: SSL connection has been closed unexpectedly`.
That second exception is *inside* the except block, so nothing in the loop
catches it — it propagates all the way up and kills the process.

**Status: fixed**, two layers:
1. `db/session.py` — `pool_pre_ping=True` on the engine. SQLAlchemy's
   standard fix for exactly this: a cheap liveness check before each
   connection checkout, transparently reconnecting if it's dead. Fixes it
   project-wide (the FastAPI app itself is equally exposed on a slow
   request), not just for this script.
2. `services/roadmap_ingest.py` — the per-day handler's `rollback()` is
   now itself wrapped in a try/except that falls back to closing and
   opening a fresh session, so even an unexpected second failure can't
   take the whole batch down.

**Lesson for future instances:** any script that holds one DB session open
across a slow, retrying external call (AI providers with backoff being the
obvious case in this project) is exposed to this. `pool_pre_ping` should be
the default assumption for anything talking to hosted Postgres from a
long-running process — don't wait to hit this a third time before adding
it to a new script.
