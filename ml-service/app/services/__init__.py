"""
Purpose:   Package marker for services/* (thin orchestrators between routers and components/domain).
Layer:     service
May import:   domain/*, schemas/*, component interfaces (injected), app.errors (domain exception classes)
Must NOT import:  other services/*, api/*, FastAPI/Starlette, asyncpg (all wrapped in components)
"""
