-- 0003_openai_embeddings.sql
-- Migrates embedding column from e5-base (768d) to OpenAI text-embedding-3-large (1536d).
-- No data migration: knowledge_base is empty in practice (will be re-seeded from scratch).
-- DROP + recreate is simpler and safer than ALTER COLUMN TYPE for a vector dimension change.

DROP INDEX IF EXISTS ix_kb_embedding;
TRUNCATE knowledge_base;  -- safe: re-seeded via Collector re-scrape

ALTER TABLE knowledge_base
    ALTER COLUMN embedding TYPE VECTOR(1536);

CREATE INDEX ix_kb_embedding ON knowledge_base
    USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
