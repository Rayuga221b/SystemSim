"""SystemSim API — entry point.

Thin by design: app setup, CORS, router registration. No business logic here.
"""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from routes import simulate, challenges, designs, casestudies, ai, admin, auth

load_dotenv()

app = FastAPI(title="SystemSim API", version="0.1.0")

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
app.include_router(simulate.router)
app.include_router(challenges.router)
app.include_router(designs.router)
app.include_router(casestudies.router)
app.include_router(ai.router)
app.include_router(admin.router)


@app.get("/health")
def health():
    return {"status": "ok"}
