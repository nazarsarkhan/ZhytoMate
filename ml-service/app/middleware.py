"""
Purpose:   X-Request-ID propagation (accept or generate) + one structured access-log line per request.
Layer:     infra
May import:   FastAPI/Starlette (BaseHTTPMiddleware), app.config, observability/* (logging)
Must NOT import:  services/*, components/*, domain/*, api/v1/* routers
"""
