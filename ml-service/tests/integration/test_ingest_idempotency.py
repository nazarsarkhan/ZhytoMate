"""
Purpose:   Integration: content_hash dedup skips re-ingest; same document_id with new text replaces old chunks in one tx (no dupes).
Layer:     test
May import:   pytest, testcontainers, app.components.repository, app.schemas/*, tests.fakes.fake_embedder
Must NOT import:  app.api routers, google-genai (DB-real, LLM-absent)
"""
