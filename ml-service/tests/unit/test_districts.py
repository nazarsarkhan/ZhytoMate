"""
Purpose:   Unit: three spellings ("Богунський район" / "Bohunskyi" / "богунка") canonicalize to one slug; unknown -> None (FIX-3 regression guard).
Layer:     test
May import:   pytest, app.domain.districts, stdlib
Must NOT import:  app.api, app.services, app.components; asyncpg, google-genai (pure/fast unit test)
"""
