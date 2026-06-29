"""
Purpose:   Idempotent migration runner. Ensures migrations_log exists, then applies each
           *.sql file in this directory (lexicographic order) exactly once, recording the name.
           Each migration + its log row commit in one transaction, so a partial apply rolls back.
           Called from the lifespan on startup; also runnable standalone (`python -m db.migrations.runner`).
Layer:     infra (migrations)
May import:   stdlib, asyncpg
Must NOT import:  app/* (the runner is a leaf used by the composition root)
"""
from __future__ import annotations

import logging
from pathlib import Path

import asyncpg

logger = logging.getLogger(__name__)

_MIGRATIONS_DIR = Path(__file__).parent

_CREATE_LOG = """
CREATE TABLE IF NOT EXISTS migrations_log (
    name       TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
)
"""


async def run_migrations(database_url: str) -> list[str]:
    """Apply pending migrations in order. Returns the names newly applied (empty if up to date)."""
    conn = await asyncpg.connect(database_url)
    try:
        await conn.execute(_CREATE_LOG)
        already_applied: set[str] = {
            row["name"] for row in await conn.fetch("SELECT name FROM migrations_log")
        }

        newly_applied: list[str] = []
        for path in sorted(_MIGRATIONS_DIR.glob("*.sql")):
            if path.name in already_applied:
                continue
            sql = path.read_text(encoding="utf-8")
            async with conn.transaction():
                await conn.execute(sql)
                await conn.execute(
                    "INSERT INTO migrations_log (name) VALUES ($1)", path.name
                )
            newly_applied.append(path.name)
            logger.info("applied migration %s", path.name)

        return newly_applied
    finally:
        await conn.close()


if __name__ == "__main__":
    import asyncio
    import os

    database_url = os.environ["DATABASE_URL"]
    applied = asyncio.run(run_migrations(database_url))
    print(f"applied: {applied}" if applied else "already up to date")
