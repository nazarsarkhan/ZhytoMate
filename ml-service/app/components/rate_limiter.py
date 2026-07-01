"""
Purpose:   Per-user rate-limit POLICY (abuse protection): hash user_id, compute the fixed window,
           decide allow/deny + Retry-After from a count. PURE policy, stdlib only — the count is
           persisted in Postgres (repository.incr_rate_limit_counter) so the limiter is SHARED
           across replicas; the service is genuinely stateless/N-replica safe (ADR-009 rev). The
           global free-tier limiter is gone (paid tier).
Layer:     component
May import:   app.config; stdlib only (window math + hashing; the counter store is the repository's,
              applied by RagService.query())
Must NOT import:  services/*, api/*, pipeline/*, other components/* (including repository —
              RagService wires count + policy together)
"""
from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass

_WINDOW_SECONDS = 60


def hash_user_id(user_id: str) -> str:
    """Full-length sha256 hex digest, used as the rate_limit table's key. RagService._hash_user's
    8-char LOG prefix is a slice of this same digest — one hash, two truncations, so there's never
    a second independent implementation to drift out of sync."""
    return hashlib.sha256(user_id.encode("utf-8")).hexdigest()


def current_window() -> int:
    """The fixed 60-second window index a request falls into right now."""
    return int(time.time()) // _WINDOW_SECONDS


@dataclass(frozen=True)
class RateDecision:
    allowed: bool
    retry_after: int | None


def evaluate(count: int, max_per_minute: int) -> RateDecision:
    """count is the value AFTER incrementing (i.e. this request's own attempt is included).
    Allowed when count <= max_per_minute."""
    allowed = count <= max_per_minute
    return RateDecision(allowed=allowed, retry_after=None if allowed else _WINDOW_SECONDS)
