"""
Purpose:   /health/live (process up), /health/ready (embedder present AND DB reachable — the compose
           gate; the LLM is deliberately NOT probed so an OpenAI blip can't pull us out of rotation,
           §5), and /health/deps (a richer dashboard-only view that DOES probe DB + OpenAI + pool
           stats, never gating traffic). Readiness is re-checked on every call.
Layer:     api
May import:   stdlib (asyncio), FastAPI (APIRouter, Request), fastapi.responses (JSONResponse)
Must NOT import:  components/* or repository directly; domain/*; services/*
"""
from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter(tags=["health"])

_PROBE_TIMEOUT_S = 2.0


@router.get("/health/live")
async def live() -> dict[str, str]:
    """Always 200 while the event loop is alive."""
    return {"status": "ok"}


@router.get("/health/ready", response_model=None)
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


@router.get("/health/deps", response_model=None)
async def health_deps(request: Request) -> dict[str, object]:
    """Dashboard-only dependency view (§7). Always 200 — callers interpret the fields. NOT the
    compose gate (that is /health/ready). Each probe is bounded by a short timeout."""
    state = request.app.state
    return {
        "db": await _probe_db(getattr(state, "pool", None)),
        "openai": await _probe_openai(getattr(state, "llm_client", None)),
        "embedder": "loaded" if getattr(state, "embedder", None) is not None else "not_loaded",
        "pool": _pool_stats(getattr(state, "pool", None)),
    }


async def _probe_db(pool: Any) -> str:
    # `Any`, not the concrete asyncpg Pool type: this module's layering contract forbids importing
    # components/* directly (see docstring above), so the probe helpers stay deliberately untyped
    # at this boundary and duck-type their way to acquire()/models.list()/get_size().
    if pool is None:
        return "not_ready"

    async def _select_one() -> None:
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")

    try:
        await asyncio.wait_for(_select_one(), timeout=_PROBE_TIMEOUT_S)
        return "ok"
    except TimeoutError:
        return "error: timeout"
    except Exception as exc:  # broad on purpose — a dashboard probe never raises
        return f"error: {type(exc).__name__}"


async def _probe_openai(client: Any) -> str:
    if client is None:
        return "not_ready"
    try:
        probe = getattr(client, "probe", None)
        if probe is None or not callable(probe):
            return "error: unsupported_client"
        await asyncio.wait_for(probe(), timeout=_PROBE_TIMEOUT_S)
        return "ok"
    except TimeoutError:
        return "timeout"
    except Exception as exc:  # broad on purpose — a dashboard probe never raises
        return f"error: {type(exc).__name__}"


def _pool_stats(pool: Any) -> dict[str, int]:
    if pool is None:
        return {"size": 0, "idle": 0}
    return {"size": pool.get_size(), "idle": pool.get_idle_size()}
