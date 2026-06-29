"""
Purpose:   IngestRequest / IngestResponse models, including the ttl_days-required-when-news validator.
Layer:     schema
May import:   stdlib, pydantic, schemas/common (doc_type enum)
Must NOT import:  api/*, services/*, components/*, domain/*; any I/O or model lib (asyncpg, google-genai, sentence-transformers, FastAPI routing)
"""
