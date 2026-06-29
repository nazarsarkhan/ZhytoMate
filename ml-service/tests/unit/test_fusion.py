"""
Purpose:   Unit: reciprocal_rank_fusion() — a chunk ranked high by both legs beats one ranked high by only one; dedup keeps a single entry per chunk id; an item present in only the lexical leg can outrank a mediocre dense-only item; empty leg is handled. Asserts the RRF score math (1/(k_rrf+rank)) and stable ordering.
Layer:     test
May import:   pytest, app.domain.fusion, stdlib
Must NOT import:  app.api, app.services, app.components, app.pipeline; asyncpg, google-genai (pure/fast unit test)
"""
