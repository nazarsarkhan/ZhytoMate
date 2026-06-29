"""
Purpose:   Unit: is_sufficient() — returns True when enough distinct hits clear SIM_GATE; False when a sub-query is thin/empty (triggering the single bounded re-query in the agent loop). Asserts thresholds are honoured from passed-in settings, not imported.
Layer:     test
May import:   pytest, app.domain.sufficiency, app.config (defaults), stdlib
Must NOT import:  app.api, app.services, app.components, app.pipeline; asyncpg, google-genai (pure/fast unit test)
"""
