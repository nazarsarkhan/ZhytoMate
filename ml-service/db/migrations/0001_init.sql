-- 0001_init.sql
-- Purpose: knowledge_base schema + indexes + HNSW vector index, taken verbatim from
--          docs/SYSTEM_DESIGN.md §2.1. Applied (idempotently) on first boot.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE knowledge_base (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id   TEXT        NOT NULL,            -- from Node; upsert key
    chunk_index   INT         NOT NULL,
    text          TEXT        NOT NULL,
    embedding     VECTOR(768) NOT NULL,            -- normalized, e5-base
    doc_type      TEXT        NOT NULL CHECK (doc_type IN ('news','instruction')),
    category      TEXT,
    district      TEXT,                            -- canonical slug (§2.6); NULL = city-wide
    source        TEXT        NOT NULL,
    content_hash  CHAR(64)    NOT NULL,            -- sha256 of normalized FULL doc text
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at    TIMESTAMPTZ,                     -- news: now()+ttl; instruction: NULL
    CONSTRAINT uq_doc_chunk UNIQUE (document_id, chunk_index)
);

-- Dedup lookup (skip ingest if identical content already present, any document_id)
CREATE INDEX ix_kb_content_hash ON knowledge_base (content_hash);

-- Reaper + freshness filter support
CREATE INDEX ix_kb_expires_at ON knowledge_base (expires_at)
    WHERE expires_at IS NOT NULL;

-- District/type pre-filter (cheap planner help for the WHERE before vector scan)
CREATE INDEX ix_kb_type_district ON knowledge_base (doc_type, district);

-- Vector index (see §2.3 for param rationale)
CREATE INDEX ix_kb_embedding ON knowledge_base
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
