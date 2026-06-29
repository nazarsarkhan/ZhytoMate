-- 0002_hybrid_search.sql
-- Purpose: per-user rate-limit counter (Postgres-backed, ADR-009 rev) — shared across
--          replicas. Applied idempotently by db/migrations/runner.py after 0001.
--
-- NOTE: filename retained from the existing scaffold per the chosen layout. The hybrid-search
--       schema (tsv column + GIN index) is consolidated into 0001_init.sql to match
--       SYSTEM_DESIGN §2.1, so this migration now carries the rate_limit table only.
--       (Rename to 0002_rate_limit.sql if you prefer the name to match the content.)

CREATE TABLE IF NOT EXISTS rate_limit (
    user_id    TEXT   NOT NULL,                         -- hashed Telegram id (PII never raw)
    window_min BIGINT NOT NULL,                         -- int(time.time()) // 60
    count      INT    NOT NULL DEFAULT 1,
    PRIMARY KEY (user_id, window_min)
);

-- Supports the reaper sweep of stale windows.
CREATE INDEX IF NOT EXISTS ix_rate_limit_window ON rate_limit (window_min);
