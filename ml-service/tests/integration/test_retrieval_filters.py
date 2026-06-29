"""
Purpose:   Integration: (instruction OR expires_at>now()) AND (district=slug OR NULL) filter; iterative_scan still yields ≥3 post-filter.
Layer:     test
May import:   pytest, testcontainers, app.components.repository, app.domain.districts, tests.fakes.fake_embedder
Must NOT import:  app.api routers, google-genai (DB-real, LLM-absent)
"""
