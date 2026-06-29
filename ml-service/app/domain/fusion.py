"""
Purpose:   reciprocal_rank_fusion(dense_ranked, lexical_ranked, k_rrf=60) -> fused list. PURE: merges the dense (pgvector) and lexical (tsvector) result lists by RRF score = sum(1 / (k_rrf + rank)) over both legs, dedup by chunk id, return re-ordered. The hybrid-retrieval merge step (pgvector's recommended fusion over a cross-encoder for this scale).
Layer:     domain
May import:   stdlib, schemas/common (Chunk type)
Must NOT import:  api/*, services/*, components/*, pipeline/*; any I/O or model lib (asyncpg, google-genai, sentence-transformers, FastAPI)
"""
