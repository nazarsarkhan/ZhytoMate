"""
Purpose:   FastAPI composition root. Lifespan: set offline env before model load, run idempotent
           migrations, open the asyncpg pool (register_vector), load the e5 model, build the
           repository, create the Gemini client, wire app.state, start the TTL reaper; tear all
           down gracefully on shutdown. Registers the error-envelope handlers, the Prometheus
           instrumentator (/metrics), and mounts the health, knowledge-ingest, chat-query, and
           vision routers.
Layer:     infra (composition root — the only module that wires across layers)
May import:   app.config, app.components/*, app.background/*, app.api/*, app.metrics,
              db.migrations.runner, google-genai, FastAPI, prometheus-fastapi-instrumentator
Must NOT import:  domain/* directly; tests/*
"""
from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from google import genai
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

    # 0. Offline flags BEFORE the model load (transformers reads them at load time). The torch
    #    thread cap is applied effectively inside Embedder via torch.set_num_threads (no env var).
    os.environ["TRANSFORMERS_OFFLINE"] = str(settings.transformers_offline)
    os.environ["HF_DATASETS_OFFLINE"] = str(settings.hf_datasets_offline)

    # 1. Idempotent migrations (safe to run every startup).
    applied = await run_migrations(settings.database_url)
    if applied:
        logger.info("applied migrations: %s", ", ".join(applied))

    # 2. DB pool — register_vector runs on every connection.
    pool = await create_pool(settings)

    # 3. Embedding model — sync load is intentional: /health/ready only goes green once the
    #    model is actually resident in memory.
    embedder = Embedder(
        settings.embed_model,
        num_threads=settings.torch_num_threads,
        cache_maxsize=settings.embed_cache_maxsize,
    )

    # 4. Repository.
    repo = KnowledgeRepository(pool)

    # 5. Gemini client (new unified SDK; key passed explicitly rather than via ambient env).
    gemini = genai.Client(api_key=settings.gemini_api_key)

    # 6. Wire app state.
    app.state.settings = settings
    app.state.pool = pool
    app.state.embedder = embedder
    app.state.repo = repo
    app.state.gemini = gemini

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
