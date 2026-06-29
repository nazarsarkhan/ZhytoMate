"""
Purpose:   Unit: prompt builders keep context and user question separated and carry the anti-injection instruction.
Layer:     test
May import:   pytest, app.domain.prompts, stdlib
Must NOT import:  app.api, app.services, app.components; asyncpg, google-genai (pure/fast unit test)
"""
