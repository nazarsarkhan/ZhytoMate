"""
Purpose:   Shared fixtures for the DB-real integration suite. Spins up ONE pgvector/pgvector:pg16
           container per session, applies the real db/migrations/*.sql, opens an asyncpg pool with
           the pgvector codec registered, and truncates the tables before every test. The LLM and the
           Embedder are never touched here — these tests exercise the real repository against real
           Postgres only (vectors are seeded directly via the helpers below).
Layer:     test
May import:   pytest, pytest-asyncio, testcontainers, asyncpg, pgvector, numpy
Must NOT import:  app.api routers, openai, sentence-transformers (DB-real, LLM/embedder-absent)
"""
from __future__ import annotations

from pathlib import Path

import asyncpg
import numpy as np
import pytest
import pytest_asyncio
from pgvector.asyncpg import register_vector
from testcontainers.postgres import PostgresContainer

PG_IMAGE = "pgvector/pgvector:pg16"
VECTOR_DIM = 1536

_MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / "db" / "migrations"


@pytest.fixture(scope="session")
def pg_container():
    """Start one real pgvector Postgres container for the whole test session."""
    with PostgresContainer(PG_IMAGE) as container:
        yield container


@pytest_asyncio.fixture(loop_scope="session", scope="session")
async def pg_pool(pg_container):
    """asyncpg pool on the session loop: applies migrations, then registers the vector codec.

    Ordering matters — CREATE EXTENSION vector (in 0001_init.sql) must run BEFORE any
    register_vector call, which resolves the 'vector' type OID. So migrations are applied on a
    plain connection first; only then is the codec-registering pool opened (mirrors the lifespan).
    """
    dsn = pg_container.get_connection_url().replace("postgresql+psycopg2", "postgresql")

    migration_conn = await asyncpg.connect(dsn)
    try:
        for migration in sorted(_MIGRATIONS_DIR.glob("*.sql")):
            await migration_conn.execute(migration.read_text(encoding="utf-8"))
    finally:
        await migration_conn.close()

    async def init(conn: asyncpg.Connection) -> None:
        await register_vector(conn)

    pool = await asyncpg.create_pool(dsn, min_size=1, max_size=5, init=init)
    yield pool
    await pool.close()


@pytest_asyncio.fixture(loop_scope="session", autouse=True)
async def clean_tables(pg_pool):
    """Reset table state before every test so each one is independent."""
    await pg_pool.execute("TRUNCATE knowledge_base, rate_limit RESTART IDENTITY CASCADE")
    yield


def make_random_vec() -> np.ndarray:
    """Normalized random 1536-dim vector for seeding test rows."""
    vec = np.random.randn(VECTOR_DIM).astype(np.float32)
    return vec / np.linalg.norm(vec)


def make_target_vec(seed_vec: np.ndarray, noise: float = 0.05) -> np.ndarray:
    """A vector close to seed_vec (high cosine) — simulates a relevant query/passage."""
    noisy = seed_vec + np.random.randn(VECTOR_DIM).astype(np.float32) * noise
    return noisy / np.linalg.norm(noisy)


def make_far_vec() -> np.ndarray:
    """A random vector, almost certainly dissimilar to any given seed."""
    return make_random_vec()


def make_content_hash(seed: int) -> str:
    """Deterministic, valid 64-char content_hash for seeding (the column is CHAR(64))."""
    return format(seed, "064x")
