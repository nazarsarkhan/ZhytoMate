-- Add the explicit document type used by the collector for official files and evergreen pages.
-- Keep instruction during the compatibility window so existing rows and older clients remain valid.

ALTER TABLE knowledge_base
    DROP CONSTRAINT IF EXISTS knowledge_base_doc_type_check;

ALTER TABLE knowledge_base
    ADD CONSTRAINT knowledge_base_doc_type_check
    CHECK (doc_type IN ('news', 'document', 'instruction'));
