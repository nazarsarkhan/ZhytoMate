"""
Purpose:   /health/live (process up) and /health/ready (model loaded AND DB reachable). Gemini is
           deliberately NOT probed — a Gemini blip must not pull the service out of rotation (the
           extractive fallback covers it, §5). Readiness is re-checked on every call, so a
           post-startup model/DB failure flips the probe red.
Layer:     api
May import:   FastAPI (APIRouter, Request), fastapi.responses (JSONResponse)
Must NOT import:  components/* or repository directly; domain/*; services/*
"""
from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter(tags=["health"])


@router.get("/health/live")
async def live() -> dict[str, str]:
    """Always 200 while the event loop is alive."""
    return {"status": "ok"}


@router.get("/health/ready")
async def ready(request: Request) -> JSONResponse | dict[str, str]:
    """200 only if the embedding model is loaded AND `SELECT 1` succeeds; else 503."""
    embedder = getattr(request.app.state, "embedder", None)
    pool = getattr(request.app.state, "pool", None)
    if embedder is None or pool is None:
        return JSONResponse({"status": "not_ready"}, status_code=503)
    try:
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
    except Exception:  # any DB/connection failure => not ready (broad on purpose for a probe)
        return JSONResponse({"status": "db_unavailable"}, status_code=503)
    return {"status": "ready"}
