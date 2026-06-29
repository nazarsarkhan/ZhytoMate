"""
Purpose:   Unit: assemble_context() — dedup by chunk id, preserves retrieval order, trims to the token budget (using an injected token counter), and emits clear source-delimited blocks for the anti-injection prompt. Asserts no chunk is silently dropped without the budget being the cause.
Layer:     test
May import:   pytest, app.domain.context, stdlib
Must NOT import:  app.api, app.services, app.components, app.pipeline; asyncpg, google-genai (pure/fast unit test)
"""
