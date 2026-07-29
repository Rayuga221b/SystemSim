"""SQLAlchemy engine + session factory.

DATABASE_URL comes from the environment (Postgres in docker-compose / AWS).
DECISION (2026-07-07): when it's absent we fall back to a local SQLite file so
`uvicorn main:app` works with zero infrastructure — a contributor (or a demo)
shouldn't need Docker running to try the product. Postgres remains the
production target; Alembic migrations apply there. SQLite tables are created
via Base.metadata.create_all at startup (see main.py).

The fallback is fail-hard, not fail-soft, when ENVIRONMENT=production: an
unset DATABASE_URL there would silently switch to a SQLite file on the
deploy host's ephemeral filesystem — every user, design, and challenge
attempt vanishes on the next restart with no visible error. A crash at
startup is much cheaper than that.
"""
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    if os.getenv("ENVIRONMENT") == "production":
        raise RuntimeError("DATABASE_URL must be set when ENVIRONMENT=production")
    DATABASE_URL = "sqlite:///./systemsim.db"

# SQLite needs check_same_thread=False because FastAPI serves requests from a
# threadpool; harmless and ignored for Postgres.
_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

# pool_pre_ping: a hosted Postgres (Neon) closes idle connections server-side
# after some minutes. A long-running script that holds a session open across
# slow external calls (e.g. the roadmap ingest waiting out an AI provider's
# rate-limit backoff) can come back to a dead connection — without this, the
# next query raises "SSL connection has been closed unexpectedly", and worse,
# doing so from inside an exception handler's own rollback() propagates
# uncaught and crashes the process (hit twice during the Neon migration; see
# docs/INCIDENTS.md). pre_ping adds a cheap liveness check before each
# checkout and transparently reconnects instead.
engine = create_engine(DATABASE_URL, connect_args=_connect_args, pool_pre_ping=True)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
