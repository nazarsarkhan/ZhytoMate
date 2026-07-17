-- 0006_split_lexical_date_labels.sql
-- Purpose: split navigation labels that run into publication dates (for example,
-- "Інтерактивна карта укриттів07.04.2025") so the service name remains searchable.

ALTER TABLE knowledge_base DROP COLUMN tsv;

ALTER TABLE knowledge_base
    ADD COLUMN tsv tsvector GENERATED ALWAYS AS (
        to_tsvector(
            'simple',
            regexp_replace(
                regexp_replace(text, '([[:lower:]])([[:upper:]])', E'\\1 \\2', 'g'),
                '([[:alpha:]])([[:digit:]])', E'\\1 \\2', 'g'
            )
        )
    ) STORED;

CREATE INDEX IF NOT EXISTS ix_kb_tsv ON knowledge_base USING gin (tsv);
