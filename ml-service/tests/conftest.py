"""
Purpose:   Shared fixtures for HTTP contract tests: a real FastAPI app (real routers, real error
           handlers, the real X-Request-ID middleware) wired directly onto app.state — the exact
           shape app.deps's factory functions read from — backed by the REAL testcontainers
           Postgres pool/repository (tests.integration.conftest.pg_pool) so ingest/query contract
           tests exercise real SQL, and by FakeEmbedder/FakeGenerator so no contract test ever makes
           a real OpenAI call. Deliberately NOT app.main's lifespan (no migrations/OpenAI
           client/TTL reaper needed) and NOT app.dependency_overrides — app.deps reads straight off
           request.app.state, so setting state directly on a bare FastAPI() is the simplest way to
           get real DI wiring without touching app/main.py.
Layer:     test
May import:   pytest, pytest_asyncio, FastAPI, httpx, app.api.v1.*, app.errors, app.middleware,
              app.config, app.components.repository, app.services.rag_service,
              app.observability.logging, tests.fakes/*, tests.integration.conftest (pg_pool only —
              never the autouse clean_tables, which must stay scoped to tests/integration so plain
              unit tests never pay for a testcontainers Postgres they don't need)
Must NOT import:  (nothing in app/* may import tests/* — tests are leaves)
"""
from __future__ import annotations

import json

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api.v1 import actions, health, ingest, query, vision
from app.components.repository import KnowledgeRepository
from app.config import Settings
from app.errors import register_error_handlers
from app.middleware import RequestLoggingMiddleware
from app.observability.logging import configure_logging
from app.services.rag_service import RagService
from tests.fakes.fake_embedder import FakeEmbedder
from tests.fakes.fake_generator import FakeGenerator

# Re-exported so pytest can resolve them by name for tests/contract, which isn't a descendant of
# tests/integration/conftest.py. pg_pool itself requests pg_container by name, so both must be
# visible here — never clean_tables (see _reset_contract_tables below for why).
from tests.integration.conftest import pg_container, pg_pool  # noqa: F401

# Configure once for the whole test session, not just when a test happens to boot the FastAPI
# lifespan (most unit tests never touch app.main at all). Without this, structlog stays on its
# un-configured default (a standalone PrintLogger that never becomes a stdlib LogRecord), so
# pytest's caplog fixture — which hooks stdlib logging — would silently capture nothing.
configure_logging()

# A literal fixture value, not a real credential — every contract test authenticates with this.
TEST_INTERNAL_TOKEN = "contract-test-internal-token"  # noqa: S105


def _build_app() -> FastAPI:
    """A bare FastAPI carrying the real routers/error handlers/request-id middleware, no lifespan.
    Callers populate app.state themselves — app.deps's factory functions read request.app.state
    directly, so this is enough to get real DI wiring without app.main's migrations, OpenAI client
    construction, or the background TTL reaper."""
    app = FastAPI()
    register_error_handlers(app)
    app.add_middleware(RequestLoggingMiddleware)  # X-Request-ID accept/generate + echo
    app.include_router(health.router)
    app.include_router(ingest.router)
    app.include_router(query.router)
    app.include_router(vision.router)
    app.include_router(actions.router)
    return app


@pytest_asyncio.fixture(loop_scope="session")
async def _reset_contract_tables(pg_pool):  # noqa: F811 — fixture param shadowing the re-export is expected
    """Contract tests live outside tests/integration, so they never see that package's autouse
    clean_tables fixture — its autouse scope is rooted at tests/integration/conftest.py, and
    re-importing an autouse fixture into this (root) conftest would make it autouse for the WHOLE
    suite, forcing every unit test to spin up a testcontainers Postgres it never needed. Truncating
    explicitly here keeps that container opt-in: only tests that actually request `client` pay for
    it, and each one starts from a clean knowledge_base/rate_limit table."""
    await pg_pool.execute("TRUNCATE knowledge_base, rate_limit RESTART IDENTITY CASCADE")
    yield


@pytest.fixture
def test_app(pg_pool, _reset_contract_tables) -> FastAPI:  # noqa: F811 — same as above
    """A fresh app + fresh fakes for every test. Individual tests may mutate
    `test_app.state.llm_client` (a different scripted FakeGenerator) or `test_app.state.settings`
    (e.g. a lower rate_limit_per_minute) before making a request — since state is read per-request
    off `request.app.state`, mutating it right up until the request is made is safe and is exactly
    how a test opts into non-default behaviour without a second fixture. `state.rag_service` is
    built here (mirroring app.main's lifespan, where it's built once and shared) rather than left
    for app.deps to construct, since app.deps.get_rag_service now only reads it off app.state — a
    test that needs different retrieval behaviour (e.g. a FakeKnowledgeRepository seeded with hits,
    to reach the answer cache without a real Postgres round trip) can replace
    `test_app.state.rag_service` wholesale the same way other tests replace `state.llm_client`."""
    app = _build_app()
    app.state.settings = Settings(
        database_url="postgresql://unused/unused",
        openai_api_key="unused",
        internal_token=TEST_INTERNAL_TOKEN,
    )
    app.state.pool = pg_pool
    app.state.repo = KnowledgeRepository(pg_pool)
    app.state.embedder = FakeEmbedder()
    # SimpleRAGPipeline.run() now calls the generator for an OPSEC safety check before anything
    # else (pipeline.base.check_query_safety, fail-closed) — a fresh FakeGenerator()'s old default
    # ("stubbed answer", not JSON) would make every contract test's query get silently blocked.
    # Scripting {"safe": true} as the FIRST call keeps this fixture's out-of-the-box behavior
    # "query succeeds" (the pre-existing default for every other test in this file); any further
    # call (detect/translate, or the grounded/ungrounded answer itself) falls back to the plain
    # "stubbed answer" placeholder — kept distinct from the safety JSON so a test that ends up
    # exercising one more call than expected doesn't get the literal string '{"safe": true}' back
    # as its "answer" text, which would be a confusing coincidence to debug. Tests exercising the
    # safety gate itself override `test_app.state.llm_client` with their own scripted FakeGenerator.
    app.state.llm_client = FakeGenerator(results=[(json.dumps({"safe": True}), 0)])
    app.state.rag_service = RagService(
        repo=app.state.repo,
        embedder=app.state.embedder,
        generator=app.state.llm_client,
        settings=app.state.settings,
    )
    return app


@pytest_asyncio.fixture(loop_scope="session")
async def client(test_app: FastAPI):
    """An httpx.AsyncClient talking to test_app in-process over ASGI — NOT starlette's
    TestClient, which runs each request through a background-thread event loop of its own. The
    real pg_pool was created on (and is pinned to) the pytest-asyncio session loop, and asyncpg
    pools cannot be used from a different event loop, so requests must run on that same loop —
    which an in-process ASGI transport guarantees and a portal-based TestClient does not."""
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://contract-test") as http_client:
        yield http_client
