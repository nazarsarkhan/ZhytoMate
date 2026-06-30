"""
Purpose:   /health/live (process up), /health/ready (model loaded AND DB reachable — the compose
           gate; Gemini deliberately NOT probed so a Gemini blip can't pull us out of rotation, §5),
           and /health/deps (a richer dashboard-only view that DOES probe DB + Gemini + pool stats,
           never gating traffic). Readiness is re-checked on every call.
Layer:     api
May import:   stdlib (asyncio), FastAPI (APIRouter, Request), fastapi.responses (JSONResponse)
Must NOT import:  components/* or repository directly; domain/*; services/*
"""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter(tags=["health"])

_PROBE_TIMEOUT_S = 2.0


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


@router.get("/health/deps")
async def health_deps(request: Request) -> dict[str, object]:
    """Dashboard-only dependency view (§7). Always 200 — callers interpret the fields. NOT the
    compose gate (that is /health/ready). Each probe is bounded by a short timeout."""
    state = request.app.state
    return {
        "db": await _probe_db(getattr(state, "pool", None)),
        "gemini": await _probe_gemini(
            getattr(state, "gemini", None), getattr(state, "settings", None)
        ),
        "embedder": "loaded" if getattr(state, "embedder", None) is not None else "not_loaded",
        "pool": _pool_stats(getattr(state, "pool", None)),
    }


async def _probe_db(pool: object | None) -> str:
    if pool is None:
        return "not_ready"

    async def _select_one() -> None:
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")

    try:
        await asyncio.wait_for(_select_one(), timeout=_PROBE_TIMEOUT_S)
        return "ok"
    except asyncio.TimeoutError:
        return "error: timeout"
    except Exception as exc:  # broad on purpose — a dashboard probe never raises
        return f"error: {type(exc).__name__}"


async def _probe_gemini(gemini: object | None, settings: object | None) -> str:
    if gemini is None or settings is None:
        return "not_ready"
    try:
        await asyncio.wait_for(
            gemini.aio.models.generate_content(model=settings.gemini_model, contents="ping"),
            timeout=_PROBE_TIMEOUT_S,
        )
        return "ok"
    except asyncio.TimeoutError:
        return "timeout"
    except Exception as exc:
        return f"error: {type(exc).__name__}"


def _pool_stats(pool: object | None) -> dict[str, int]:
    if pool is None:
        return {"size": 0, "idle": 0}
    return {"size": pool.get_size(), "idle": pool.get_idle_size()}
