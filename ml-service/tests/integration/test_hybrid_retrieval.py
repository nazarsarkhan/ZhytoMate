"""
Purpose:   Integration (real Postgres+pgvector, seeded fixed vectors): the hybrid proof. A query whose exact token (street/date/district) is missed by the dense leg alone is recovered by the lexical (tsvector) leg and surfaced via RRF. Also asserts metadata filters (district, expires_at) and SET LOCAL ef_search/iterative_scan still apply inside the single retrieval transaction.
Layer:     test
May import:   pytest, testcontainers, app.components.repository, app.domain.fusion, tests.fakes/*
Must NOT import:  google-genai (real Gemini never called in CI); app.api routers
"""
