"""
Purpose:   X-Request-ID propagation (accept or generate) + one structured access-log line per request.
Layer:     infra
May import:   FastAPI/Starlette (BaseHTTPMiddleware), app.config, observability/* (logging)
Must NOT import:  services/*, components/*, domain/*, api/v1/* routers
"""
from __future__ import annotations

import time
import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = structlog.get_logger(__name__)

_REQUEST_ID_HEADER = "X-Request-ID"


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Accepts an inbound X-Request-ID or generates one, binds it into structlog's contextvars for
    the lifetime of the request (so every log line emitted deep inside a service/pipeline call
    automatically carries it with zero signature changes), logs one access-log line per request,
    and echoes the id back on the response header."""

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get(_REQUEST_ID_HEADER) or uuid.uuid4().hex
        request.state.request_id = request_id
        start = time.perf_counter()
        with structlog.contextvars.bound_contextvars(request_id=request_id):
            try:
                response = await call_next(request)
            except Exception:
                # No traceback here on purpose: app.errors._unhandled_error_handler (running
                # outside this middleware, as ServerErrorMiddleware's error_handler) owns the one
                # authoritative traceback log for unhandled exceptions. Rendering one here too
                # would duplicate it under a different event name and without the request id.
                logger.warning(
                    "http_access",
                    method=request.method,
                    path=request.url.path,
                    status=500,
                    took_ms=round((time.perf_counter() - start) * 1000, 1),
                )
                raise
            took_ms = round((time.perf_counter() - start) * 1000, 1)
            logger.info(
                "http_access",
                method=request.method,
                path=request.url.path,
                status=response.status_code,
                took_ms=took_ms,
            )
            response.headers[_REQUEST_ID_HEADER] = request_id
            return response
