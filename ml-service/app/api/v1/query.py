"""
Purpose:   POST /chat/query — per-user rate limit, validate request, delegate to rag_service, return QueryResponse.
Layer:     api
May import:   FastAPI (APIRouter), schemas/query, app.deps (rag_service + rate_limiter accessors), app.errors
Must NOT import:  components/* or repository directly; domain/* directly (go through rag_service); google-genai, asyncpg, sentence-transformers
"""
