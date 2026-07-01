"""
Purpose:   Package marker for domain/* (pure logic, no I/O — this is where unit tests live).
Layer:     domain
May import:   stdlib, schemas/common (shared enums/types)
Must NOT import:  api/*, services/*, components/*, infra; any I/O or model lib (asyncpg, transformers, FastAPI). Clients/tokenizers are injected as call args to keep this layer pure.
"""
