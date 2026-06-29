"""
Purpose:   Unit: chunker honours target 380 / hard-max 480 / overlap 50 token boundaries and never exceeds 512.
Layer:     test
May import:   pytest, app.domain.chunker, stdlib
Must NOT import:  app.api, app.services, app.components; asyncpg, google-genai (pure/fast unit test)
"""
