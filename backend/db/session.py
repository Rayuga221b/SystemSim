"""SQLAlchemy engine + session factory.

DATABASE_URL comes from the environment (Postgres in docker-compose / AWS).
DECISION (2026-07-07): when it's absent we fall back to a local SQLite file so
`uvicorn main:app` works with zero infrastructure — a contributor (or a demo)
shouldn't need Docker running to try the product. Postgres remains the
production target; Alembic migrations apply there. SQLite tables are created
via Base.metadata.create_all at startup (see main.py).
"""
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./systemsim.db")

# SQLite needs check_same_thread=False because FastAPI serves requests from a
# threadpool; harmless and ignored for Postgres.
_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=_connect_args)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
