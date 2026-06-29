"""
Purpose:   Integration: with seeded vectors, cosine ordering of retrieved rows is exact and deterministic.
Layer:     test
May import:   pytest, testcontainers, app.components.repository, numpy
Must NOT import:  app.api routers, google-genai (DB-real, LLM-absent)
"""
