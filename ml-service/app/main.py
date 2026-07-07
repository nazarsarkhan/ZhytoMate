"""
Purpose:   FastAPI composition root. Lifespan: run idempotent migrations, open the asyncpg pool
           (register_vector), build the OpenAI-backed embedder, build the repository, create the
           OpenAILLMClient (Generator + VisionGenerator), build the single shared RagService (it
           owns the answer cache, so it must be built once here rather than per-request — see
           app.deps.get_rag_service), wire app.state, start the TTL reaper; tear all down gracefully
           on shutdown. Registers the error-envelope handlers, the Prometheus instrumentator
           (/metrics), and mounts the health, knowledge-ingest, chat-query, vision, and assistant
           slot-extraction routers.
Layer:     infra (composition root — the only module that wires across layers)
May import:   app.config, app.components/*, app.services.rag_service, app.background/*, app.api/*,
              app.metrics, app.middleware, app.observability.logging, db.migrations.runner, FastAPI,
              prometheus-fastapi-instrumentator
Must NOT import:  domain/* directly; tests/*
"""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager, suppress

import structlog
from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator

from app import metrics  # noqa: F401 — import registers the custom counters at startup
from app.api.v1 import actions, health, ingest, query, vision
from app.background.reaper import ttl_reaper
from app.components.embedder import Embedder
from app.components.llm import OpenAILLMClient
from app.components.repository import KnowledgeRepository, create_pool
from app.config import get_settings
from app.errors import register_error_handlers
from app.middleware import RequestLoggingMiddleware
from app.observability.logging import configure_logging
from app.services.rag_service import RagService
from db.migrations.runner import run_migrations

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()  # must run before anything else can log
    settings = get_settings()

    # 1. Idempotent migrations (safe to run every startup).
    applied = await run_migrations(settings.database_url)
    if applied:
        logger.info("migrations_applied", migrations=applied)

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

    # 5. LLM client (async; key passed explicitly rather than via ambient env). One instance backs
    #    both the Generator and VisionGenerator ports.
    llm_client = OpenAILLMClient(api_key=settings.openai_api_key, model=settings.llm_model)

    # 6. RagService — built once and shared across all requests. It owns the answer cache
    #    internally (_AnswerCache), so a fresh instance per request would mean a fresh, empty cache
    #    per request and no answer could ever be reused by a later request. app.deps.get_rag_service
    #    reads this single instance off app.state instead of constructing its own.
    rag_service = RagService(repo=repo, embedder=embedder, generator=llm_client, settings=settings)

    # 7. Wire app state.
    app.state.settings = settings
    app.state.pool = pool
    app.state.embedder = embedder
    app.state.repo = repo
    app.state.llm_client = llm_client
    app.state.rag_service = rag_service

    # 8. TTL reaper background task.
    reaper = asyncio.create_task(ttl_reaper(repo))

    try:
        yield  # app serves requests here
    finally:
        # 9. Graceful shutdown.
        reaper.cancel()
        with suppress(asyncio.CancelledError):
            await reaper
        await pool.close()


app = FastAPI(lifespan=lifespan, title="ZhytoMate ML Service")
register_error_handlers(app)
app.add_middleware(RequestLoggingMiddleware)  # X-Request-ID propagation + per-request access log
Instrumentator().instrument(app).expose(app)  # adds /metrics (HTTP latency/throughput)
app.include_router(health.router)
app.include_router(ingest.router)
app.include_router(query.router)
app.include_router(vision.router)
app.include_router(actions.router)
