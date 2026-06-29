"""
Purpose:   classify(user_query, settings) -> QueryComplexity (SIMPLE | COMPLEX). PURE heuristic — word-count threshold + Ukrainian COMPLEX_KEYWORDS presence (порівняй / чому / найкращ… / список / усі / крок за кроком / >=2 '?'), no LLM, no side effects. Biased toward SIMPLE; COMPLEX must be earned. The R2RAG routing decision.
Layer:     domain
May import:   stdlib, schemas/common; thresholds/keywords passed in (sourced from config), not imported
Must NOT import:  api/*, services/*, components/*, pipeline/*; any I/O or model lib (asyncpg, google-genai, sentence-transformers, FastAPI). config (keep pure — thresholds are arguments)
"""
