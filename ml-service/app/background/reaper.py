"""
Purpose:   Periodic TTL reaper coroutine — every interval, DELETE expired knowledge_base rows
           via the injected repository (design §2.5). Created/cancelled as an asyncio task by the
           lifespan. Resilient: a failed sweep is logged and retried next tick, never crashing.
Layer:     background
May import:   stdlib (asyncio, logging); components/repository (type only)
Must NOT import:  api/*, services/*, schemas/*, domain/*
"""
from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.components.repository import KnowledgeRepository

logger = logging.getLogger(__name__)

_REAP_INTERVAL_SECONDS = 600


async def ttl_reaper(
    repo: "KnowledgeRepository", interval_seconds: int = _REAP_INTERVAL_SECONDS
) -> None:
    """Delete expired rows every `interval_seconds`. Runs until cancelled by the lifespan."""
    while True:
        await asyncio.sleep(interval_seconds)
        try:
            deleted = await repo.delete_expired()
            if deleted:
                logger.info("ttl_reaper deleted %d expired rows", deleted)
        except asyncio.CancelledError:
            raise  # propagate cancellation so the task stops cleanly on shutdown
        except Exception:
            # Never crash the reaper — the next tick retries.
            logger.exception("ttl_reaper sweep failed; will retry next tick")
