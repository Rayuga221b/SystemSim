"""SystemSim API — entry point.

Thin by design: app setup, CORS, router registration. No business logic here.

Startup creates tables via SQLAlchemy metadata — that is the whole schema
story for the SQLite dev fallback. Postgres deployments run Alembic
migrations instead (create_all is a no-op on tables that already exist).
"""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from db.base import Base
from db.session import engine
import models  # noqa: F401 — register all models on Base before create_all
from routes import simulate, challenges, designs, casestudies, ai, admin, auth, me


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="SystemSim API", version="1.0.0", lifespan=lifespan)

# Frontend origins allowed to call this API.
origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(me.router)
app.include_router(simulate.router)
app.include_router(challenges.router)
app.include_router(designs.router)
app.include_router(casestudies.router)
app.include_router(ai.router)
app.include_router(admin.router)


@app.get("/health")
def health():
    return {"status": "ok"}
