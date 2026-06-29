"""
Purpose:   Ingest orchestration: clean text -> dedup by content_hash -> chunk -> embed(passage:) -> upsert in one tx.
Layer:     service
May import:   domain/* (text, chunker), schemas/ingest, embedder + repository INTERFACES (injected), app.errors
Must NOT import:  other services/*, api/*, FastAPI/Starlette, asyncpg, google-genai, sentence-transformers (use injected components)
"""
