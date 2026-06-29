"""
Purpose:   is_sufficient(chunks, settings) -> bool. PURE stop-gate for the agent branch: does a sub-query's retrieval have enough distinct hits above SIM_GATE to stop, or should it be re-queried once? Bounds the agent loop without an LLM call. Distinct from confidence.py (which maps top-1 sim -> user-facing band).
Layer:     domain
May import:   stdlib, schemas/common; thresholds passed in (from config), not imported
Must NOT import:  api/*, services/*, components/*, pipeline/*; any I/O or model lib (asyncpg, google-genai, sentence-transformers, FastAPI)
"""
