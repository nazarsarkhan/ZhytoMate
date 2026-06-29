"""
Purpose:   Error envelope shape + FastAPI exception handlers + dependency-light domain exception classes (services raise, handlers map to envelopes).
Layer:     infra
May import:   stdlib, schemas/common (ErrorEnvelope), FastAPI/Starlette (for handler registration only)
Must NOT import:  services/*, components/*, api/v1/* routers, domain/* (errors is a leaf others import; keep exception classes import-light so services can raise them without pulling FastAPI)
"""
