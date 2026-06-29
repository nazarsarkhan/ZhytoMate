"""
Purpose:   AgentRAGPipeline(RAGPipeline): COMPLEX path via query DECOMPOSITION (not open-ended rewriting). decompose(query) -> <= AGENT_MAX_SUBQUERIES sub-queries (1 Generator call) -> embed + hybrid-retrieve each IN PARALLEL (asyncio.gather) -> is_sufficient per sub-query, re-query a dry one at most ONCE (the bounded "max 3 / rewrite" semantics) -> merge+dedup -> assemble_context -> shared tail with one synthesis call. Gated by AGENT_RAG_ENABLED; falls back to SimpleRAGPipeline when off.
Layer:     pipeline
May import:   pipeline/base, protocols (Embedder/Retriever/Generator), domain/{fusion,context,sufficiency,confidence,prompts}, schemas/*, app.config (types)
Must NOT import:  api/*, services/*; concrete components/*; FastAPI, asyncpg, google-genai, sentence-transformers
"""
