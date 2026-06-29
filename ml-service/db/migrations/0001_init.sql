-- 0001_init.sql
-- Purpose: knowledge_base schema + indexes (lexical tsv + HNSW vector) per
--          docs/SYSTEM_DESIGN.md §2.1 / §2.8. Applied idempotently by db/migrations/runner.py.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS knowledge_base (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id   TEXT        NOT NULL,                 -- from Collector; upsert key
    chunk_index   INT         NOT NULL,
    text          TEXT        NOT NULL,
    embedding     VECTOR(768) NOT NULL,                 -- full fp32 e5-base (NOT halfvec)
    doc_type      TEXT        NOT NULL CHECK (doc_type IN ('news','instruction')),
    category      TEXT,
    district      TEXT,                                 -- canonical slug; NULL = city-wide
    source        TEXT        NOT NULL,
    content_hash  CHAR(64)    NOT NULL,                 -- sha256 hex of normalized full doc
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at    TIMESTAMPTZ,                          -- news: now()+ttl; instruction: NULL
    -- Lexical leg for hybrid retrieval (§2.8). 'simple' (no stemming) is intentional:
    -- exact-token recall for Ukrainian, which has no built-in Postgres FTS dictionary.
    tsv           tsvector GENERATED ALWAYS AS (to_tsvector('simple', text)) STORED,
    CONSTRAINT uq_doc_chunk UNIQUE (document_id, chunk_index)
);

-- Dedup lookup (skip ingest when identical content already present, any document_id).
CREATE INDEX IF NOT EXISTS ix_kb_content_hash ON knowledge_base (content_hash);

-- Reaper + freshness filter support (partial: only rows that can expire).
CREATE INDEX IF NOT EXISTS ix_kb_expires_at ON knowledge_base (expires_at)
    WHERE expires_at IS NOT NULL;

-- Pre-filter help for the WHERE before the vector scan.
CREATE INDEX IF NOT EXISTS ix_kb_type_district ON knowledge_base (doc_type, district);

-- Full-text (lexical) index for the hybrid retrieval lexical leg.
CREATE INDEX IF NOT EXISTS ix_kb_tsv ON knowledge_base USING gin (tsv);

-- Dense vector index (cosine; query uses `embedding <=> $1`).
CREATE INDEX IF NOT EXISTS ix_kb_embedding ON knowledge_base
    USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
