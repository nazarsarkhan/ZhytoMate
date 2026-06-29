"""
Purpose:   POST /knowledge/ingest — parse/validate request, delegate to ingest_service, return IngestResponse.
Layer:     api
May import:   FastAPI (APIRouter), schemas/ingest, app.deps (ingest_service accessor), app.errors
Must NOT import:  components/* or repository directly; domain/* directly (go through ingest_service); google-genai, asyncpg, sentence-transformers
"""
