"""
Purpose:   Unit: classify() truth table — short single-intent queries -> SIMPLE; multi-intent / comparison ('порівняй') / enumeration / >=2 '?' / over-length -> COMPLEX. Asserts purity (same input -> same output, no side effects) and that the bias favours SIMPLE on ambiguous short queries.
Layer:     test
May import:   pytest, app.domain.classifier, app.config (for default thresholds), stdlib
Must NOT import:  app.api, app.services, app.components, app.pipeline; asyncpg, google-genai (pure/fast unit test)
"""
