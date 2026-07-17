-- 0005_normalize_lexical_tsv.sql
-- Purpose: recover lexical matches from scraped navigation labels that were concatenated without
-- whitespace (for example, "Звернення громадянПрийом громадян"). The source text and embeddings
-- remain unchanged; only the derived full-text column is rebuilt.

ALTER TABLE knowledge_base DROP COLUMN tsv;

ALTER TABLE knowledge_base
    ADD COLUMN tsv tsvector GENERATED ALWAYS AS (
        to_tsvector(
            'simple',
            regexp_replace(text, '([[:lower:]])([[:upper:]])', E'\\1 \\2', 'g')
        )
    ) STORED;

CREATE INDEX IF NOT EXISTS ix_kb_tsv ON knowledge_base USING gin (tsv);
