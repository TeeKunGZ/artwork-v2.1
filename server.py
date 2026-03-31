"""
ArtPortal v2 — server bootstrap
================================
This file only wires together the application.
All business logic lives in app/routers/ and app/services/.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from app.db.base import init_db
from app.routers import auth, admin, core, ai, export

import os

os.makedirs("/app/data",   exist_ok=True)   # persistent data volume
os.makedirs("dataset",    exist_ok=True)
os.makedirs("history_db", exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────────────
    init_db()
    print("✅ ArtPortal v2 started — database ready")
    yield
    # ── Shutdown ─────────────────────────────────────────────────────────────
    print("👋 ArtPortal shutting down")


app = FastAPI(
    title="ArtPortal API",
    version="2.0.0",
    lifespan=lifespan,
)

# ── Static files ──────────────────────────────────────────────────────────────
app.mount("/js", StaticFiles(directory="js"), name="js")

# ── Routers ───────────────────────────────────────────────────────────────────
# Auth  — /api/login, /api/me, /api/users/me/password
app.include_router(auth.router,   prefix="/api")

# Admin — /api/admin/users/*, /api/admin/teams/*
app.include_router(admin.router,  prefix="/api/admin", tags=["Admin"])

# Teams list — /api/teams  (read-only, available to all logged-in users)
# Re-export the same handler under the legacy path so the frontend JS keeps working
from fastapi import Depends
from app.db.base import get_db
from app.dependencies import get_current_user
from app.db import crud as _crud

@app.get("/api/teams", tags=["Teams"])
async def list_teams_legacy(
    db=Depends(get_db),
    _=Depends(get_current_user),
):
    return [{"id": t.id, "name": t.name} for t in _crud.get_all_teams(db)]

# Core  — /api/extract-ai, /api/auto_detect, /api/save-crop-memory, /api/get-template
app.include_router(core.router,   prefix="/api")

# AI    — /api/ai/train, /api/ai/predict, /api/ai/save-dataset
app.include_router(ai.router,     prefix="/api/ai")

# Export — /api/generate-excel, /api/generate-zip
app.include_router(export.router, prefix="/api")


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["System"])
async def health_check():
    return {"status": "ok"}


# ── Frontend SPA ──────────────────────────────────────────────────────────────
@app.get("/")
async def serve_frontend():
    with open("index.html", encoding="utf-8") as f:
        return HTMLResponse(f.read())


# ── Dev entrypoint ────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)