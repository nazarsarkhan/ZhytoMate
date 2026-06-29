"""
Purpose:   FastAPI app + lifespan: load e5, open asyncpg pool, start reaper, wire DI, mount routers + middleware.
Layer:     infra
May import:   app.config, app.deps, app.errors, app.middleware, api/*, services/*, components/*, background/*, observability/* (this is the composition root — the only place allowed to wire every layer together in lifespan)
Must NOT import:  domain/* directly (reach it through services/components); tests/*
"""
