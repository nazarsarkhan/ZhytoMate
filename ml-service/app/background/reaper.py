"""
Purpose:   Periodic reaper coroutine — every interval, DELETE expired knowledge_base rows and
           stale rate_limit windows via the injected repository (design §2.5). Created/cancelled
           as an asyncio task by the lifespan. Resilient: a failed sweep is logged and retried
           next tick, never crashing.
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
    """Delete expired knowledge_base rows and stale rate_limit windows every `interval_seconds`.
    Runs until cancelled by the lifespan.

    Both sweeps share one try/except: they're independent one-tick housekeeping jobs against the
    same pool, and if the pool/connection is having trouble, one sweep failing usually means the
    other would fail too. Retrying both together next tick is simpler than tracking each sweep's
    own error state, and neither sweep's rows accumulate meaningfully over a single missed
    interval (the index comment on ix_rate_limit_window already anticipates a lagging reaper).
    """
    while True:
        await asyncio.sleep(interval_seconds)
        try:
            deleted = await repo.delete_expired()
            if deleted:
                logger.info("ttl_reaper deleted %d expired rows", deleted)
            stale_windows = await repo.delete_stale_rate_limit_windows()
            if stale_windows:
                logger.info("ttl_reaper deleted %d stale rate_limit rows", stale_windows)
        except asyncio.CancelledError:
            raise  # propagate cancellation so the task stops cleanly on shutdown
        except Exception:
            # Never crash the reaper — the next tick retries both sweeps.
            logger.exception("ttl_reaper sweep failed; will retry next tick")
