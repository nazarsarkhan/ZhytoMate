"""
Purpose:   Error-envelope rendering + FastAPI exception handlers + dependency-light domain
           exception classes. Services/deps raise AppError subclasses (no FastAPI), the registered
           handlers map them to the §3.3 envelope. FastAPI is imported lazily inside the handlers so
           importing this module (e.g. from a service) never pulls FastAPI.
Layer:     infra
May import:   stdlib, structlog, schemas/common (ErrorEnvelope); FastAPI/Starlette only inside
              handler bodies
Must NOT import:  services/*, components/*, api/v1/* routers, domain/* (errors is a leaf others import)
"""
from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

import structlog

from app.schemas.common import ErrorDetail, ErrorEnvelope

if TYPE_CHECKING:
    from fastapi import FastAPI, Request
    from fastapi.exceptions import RequestValidationError
    from fastapi.responses import JSONResponse

logger = structlog.get_logger(__name__)


class AppError(Exception):
    """Base for raised-and-rendered errors. Subclasses set their stable code + HTTP status, and may
    set retry_after to emit a Retry-After header (§3.3)."""

    code = "internal_error"
    status_code = 500
    retry_after: int | None = None

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class UnauthorizedError(AppError):
    code = "unauthorized"
    status_code = 401


class InvalidRequestError(AppError):
    code = "invalid_request"
    status_code = 400


class RateLimitedError(AppError):
    code = "rate_limited"
    status_code = 429
    retry_after = 60


def _request_id(request: Request) -> str:
    """Prefer the middleware-propagated id, then the inbound header, else a fresh one."""
    return getattr(request.state, "request_id", None) or request.headers.get(
        "X-Request-ID"
    ) or uuid.uuid4().hex


def _envelope(
    code: str,
    message: str,
    request_id: str,
    status_code: int,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    from fastapi.responses import JSONResponse

    body = ErrorEnvelope(error=ErrorDetail(code=code, message=message, request_id=request_id))
    return JSONResponse(body.model_dump(), status_code=status_code, headers=headers)


async def _app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    headers = {"Retry-After": str(exc.retry_after)} if exc.retry_after is not None else None
    return _envelope(exc.code, exc.message, _request_id(request), exc.status_code, headers)


async def _validation_error_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    # Body validation (e.g. ttl_days missing for news) -> documented 400 invalid_request (§3.3),
    # not FastAPI's default 422.
    parts = [
        f"{'.'.join(str(p) for p in err['loc'][1:]) or 'body'}: {err['msg']}"
        for err in exc.errors()
    ]
    message = "; ".join(parts) or "invalid request"
    return _envelope("invalid_request", message, _request_id(request), 400)


async def _unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception(
        "unhandled_error",
        request_id=_request_id(request),
        method=request.method,
        path=request.url.path,
    )
    return _envelope("internal_error", "Internal server error", _request_id(request), 500)


def register_error_handlers(app: FastAPI) -> None:
    """Wire the three handlers. Called once from main.py after app construction."""
    from fastapi.exceptions import RequestValidationError

    # Starlette's add_exception_handler stub types handlers as accepting the base Exception,
    # but its ExceptionMiddleware dispatches by the registered exception class at runtime — a
    # handler narrowed to a specific subclass is the documented FastAPI pattern, just one the
    # stub doesn't model. See https://fastapi.tiangolo.com/tutorial/handling-errors/.
    app.add_exception_handler(AppError, _app_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(RequestValidationError, _validation_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, _unhandled_error_handler)
