"""
Purpose:   News-retention policy (§2.5): which news categories are "evergreen" — a permanent civic
           record that must never expire or be reaped, treated exactly like a document
           (expires_at = NULL). Single source of truth for the ingest expiry decision, kept in the
           pure domain so the service never hard-codes category strings.
Layer:     domain
May import:   stdlib
Must NOT import:  api/*, services/*, components/*; any I/O or model lib (asyncpg, FastAPI routing)
"""
from __future__ import annotations

# Categories whose items are a permanent public record and must outlive any TTL — e.g. memorials of
# fallen defenders, which a civic assistant must never silently delete. Stored with expires_at =
# NULL, so the reaper never touches them and the freshness filter always keeps them.
EVERGREEN_CATEGORIES: frozenset[str] = frozenset({"memorial"})


def is_evergreen_news(category: str | None) -> bool:
    """True when a news item's category makes it permanent (never expires)."""
    return category is not None and category.lower() in EVERGREEN_CATEGORIES
