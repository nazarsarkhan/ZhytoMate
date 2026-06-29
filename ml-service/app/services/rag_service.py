"""
Purpose:   RAG ROUTER (R2RAG). classify(user_query) -> dispatch to SimpleRAGPipeline (SIMPLE) or AgentRAGPipeline (COMPLEX) -> map RagResult to QueryResponse. Owns the extractive fallback and the no-info short-circuit so both branches share one resilient tail. Pipelines + components are injected; this is the only place routing lives.
Layer:     service
May import:   domain/classifier, pipeline/* (RAGPipeline + the two concretes, injected), schemas/query, app.errors
Must NOT import:  other services/*, api/*, FastAPI/Starlette, asyncpg, google-genai, sentence-transformers (use injected pipelines/components)
"""
