"""
Purpose:   FastAPI composition root. Lifespan: run idempotent migrations, open the asyncpg pool
           (register_vector), build the OpenAI-backed embedder, build the repository, create the
           OpenAI client, wire app.state, start the TTL reaper; tear all down gracefully on
           shutdown. Registers the error-envelope handlers, the Prometheus instrumentator
           (/metrics), and mounts the health, knowledge-ingest, chat-query, and vision routers.
Layer:     infra (composition root — the only module that wires across layers)
May import:   app.config, app.components/*, app.background/*, app.api/*, app.metrics,
              db.migrations.runner, openai, FastAPI, prometheus-fastapi-instrumentator
Must NOT import:  domain/* directly; tests/*
"""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from openai import AsyncOpenAI
from prometheus_fastapi_instrumentator import Instrumentator

from app import metrics  # noqa: F401 — import registers the custom counters at startup
from app.api.v1 import health, ingest, query, vision
from app.background.reaper import ttl_reaper
from app.components.embedder import Embedder
from app.components.repository import KnowledgeRepository, create_pool
from app.config import get_settings
from app.errors import register_error_handlers
from db.migrations.runner import run_migrations

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()

    # 1. Idempotent migrations (safe to run every startup).
    applied = await run_migrations(settings.database_url)
    if applied:
        logger.info("applied migrations: %s", ", ".join(applied))

    # 2. DB pool — register_vector runs on every connection.
    pool = await create_pool(settings)

    # 3. Embedder — OpenAI-backed (no local model load; embeddings are a network call).
    embedder = Embedder(
        api_key=settings.openai_api_key,
        model=settings.embed_model,
        cache_maxsize=settings.embed_cache_maxsize,
    )

    # 4. Repository.
    repo = KnowledgeRepository(pool)

    # 5. OpenAI client (async; key passed explicitly rather than via ambient env).
    openai_client = AsyncOpenAI(api_key=settings.openai_api_key)

    # 6. Wire app state.
    app.state.settings = settings
    app.state.pool = pool
    app.state.embedder = embedder
    app.state.repo = repo
    app.state.openai_client = openai_client

    # 7. TTL reaper background task.
    reaper = asyncio.create_task(ttl_reaper(repo))

    try:
        yield  # app serves requests here
    finally:
        # 8. Graceful shutdown.
        reaper.cancel()
        try:
            await reaper
        except asyncio.CancelledError:
            pass
        await pool.close()


app = FastAPI(lifespan=lifespan, title="ZhytoMate ML Service")
register_error_handlers(app)
Instrumentator().instrument(app).expose(app)  # adds /metrics (HTTP latency/throughput)
app.include_router(health.router)
app.include_router(ingest.router)
app.include_router(query.router)
app.include_router(vision.router)
