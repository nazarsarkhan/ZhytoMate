"""
Purpose:   assemble_context(chunks, token_budget) -> str. PURE: dedup by chunk id, order by retrieval rank, trim to a token budget, and delimit context blocks with clear source markers for the anti-injection prompt. Shared by both pipelines so the no-info gate / generation tail is identical on the SIMPLE and COMPLEX branches.
Layer:     domain
May import:   stdlib, schemas/common (Chunk type)
Must NOT import:  api/*, services/*, components/*, pipeline/*; any I/O or model lib (asyncpg, google-genai, sentence-transformers, FastAPI). Token counting uses an injected callable to stay pure.
"""
