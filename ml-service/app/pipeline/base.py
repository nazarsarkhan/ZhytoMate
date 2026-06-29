"""
Purpose:   RAGPipeline(ABC).run(ctx: RagContext) -> RagResult — the contract both branches honour so they converge on one shared tail (no-info gate -> generate -> extractive fallback). Defines RagContext (user_query, district filter, qvec) and RagResult (answer, sources_used, confidence, route, debug) as pydantic v2 internal DTOs (not HTTP I/O — that stays schemas/query).
Layer:     pipeline
May import:   stdlib (abc), pydantic, protocols, schemas/*, domain/* (types)
Must NOT import:  api/*, services/*; concrete components/*; FastAPI, asyncpg, google-genai, sentence-transformers
"""
