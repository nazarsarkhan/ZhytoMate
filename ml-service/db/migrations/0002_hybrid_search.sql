-- 0002_hybrid_search.sql
-- Purpose: hybrid retrieval (dense pgvector + Postgres full-text) per SYSTEM_DESIGN §2.8,
--          plus the Postgres-backed rate-limit counter that makes the service N-replica safe
--          (ADR-009 rev). Idempotent; applied on boot after 0001_init.sql.
--
-- Full-text config note: Postgres ships no Ukrainian dictionary, so we use the language-agnostic
-- 'simple' config (no stemming) — correct for the lexical leg whose job is exact-token recall
-- (dates, street names, district names) that e5's narrow similarity band misses. A real Ukrainian
-- FTS dictionary is a documented upgrade (§2.8 / out of scope), not built now.

-- pg_trgm: fuzzy matching for misspelled exact tokens (street/place names). Optional but cheap.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- Lexical leg: a generated tsvector kept in sync with `text`, indexed with GIN.
-- ---------------------------------------------------------------------------
ALTER TABLE knowledge_base
    ADD COLUMN IF NOT EXISTS tsv tsvector
        GENERATED ALWAYS AS (to_tsvector('simple', text)) STORED;

-- Full-text index for the lexical leg (websearch_to_tsquery + ts_rank_cd).
CREATE INDEX IF NOT EXISTS ix_kb_tsv ON knowledge_base USING gin (tsv);

-- Trigram index for fuzzy exact-token fallback on raw text.
CREATE INDEX IF NOT EXISTS ix_kb_text_trgm ON knowledge_base USING gin (text gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Distributed rate limiting (ADR-009 rev): a shared counter table replaces the
-- in-memory per-user limiter so the stateless ML service scales to N replicas.
-- One row per (key, fixed window); atomic upsert increments `count` per request.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limit (
    key           TEXT        NOT NULL,            -- hashed user_id (PII never stored raw)
    window_start  TIMESTAMPTZ NOT NULL,            -- truncated to the limiter window
    count         INT         NOT NULL DEFAULT 0,
    CONSTRAINT pk_rate_limit PRIMARY KEY (key, window_start)
);

-- Cheap reclaim of stale windows (reaper / pg_cron deletes where window_start < now()-interval).
CREATE INDEX IF NOT EXISTS ix_rate_limit_window ON rate_limit (window_start);
