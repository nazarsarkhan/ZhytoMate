"""
Purpose:   Package marker for services/* (thin orchestrators between routers and components/domain).
Layer:     service
May import:   domain/*, schemas/*, component interfaces (injected), app.errors (domain exception classes)
Must NOT import:  other services/*, api/*, FastAPI/Starlette, asyncpg, google-genai, sentence-transformers (all wrapped in components)
"""
