"""
Purpose:   Unit: RequestLoggingMiddleware's externally-observable X-Request-ID header contract —
           accept-or-generate, echoed back on the response. app.errors._request_id and the rest of
           the system depend on request.state.request_id being populated correctly; the generic
           access-log line's content is not asserted here (that's covered by
           test_logging_config.py). Also covers the ServerErrorMiddleware/RequestLoggingMiddleware
           ordering regression: a truly unhandled exception must be logged with a rendered traceback
           exactly once, and that log line must still carry the request id even though it runs
           outside this middleware.
Layer:     test
May import:   pytest, fastapi.testclient, app.middleware, app.errors, app.observability.logging
Must NOT import:  live network
"""
from __future__ import annotations

import json
import logging

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.errors import register_error_handlers
from app.middleware import RequestLoggingMiddleware
from app.observability.logging import configure_logging


def _client() -> TestClient:
    app = FastAPI()
    app.add_middleware(RequestLoggingMiddleware)

    @app.get("/ping")
    async def ping() -> dict[str, str]:
        return {"status": "ok"}

    return TestClient(app)


def test_response_echoes_a_freshly_generated_request_id_when_none_is_sent() -> None:
    response = _client().get("/ping")

    assert response.status_code == 200
    assert response.headers["X-Request-ID"]


def test_response_echoes_back_the_clients_own_request_id() -> None:
    response = _client().get("/ping", headers={"X-Request-ID": "client-supplied-id"})

    assert response.headers["X-Request-ID"] == "client-supplied-id"


def test_two_requests_without_a_client_id_get_distinct_generated_ids() -> None:
    client = _client()

    first = client.get("/ping")
    second = client.get("/ping")

    assert first.headers["X-Request-ID"] != second.headers["X-Request-ID"]


def test_unhandled_exception_is_logged_with_one_traceback_carrying_the_request_id(
    capsys: pytest.CaptureFixture[str],
) -> None:
    """Regression for the ServerErrorMiddleware ordering bug: app.errors._unhandled_error_handler
    is registered for the generic Exception type, which Starlette special-cases into
    ServerErrorMiddleware's error_handler — running OUTSIDE RequestLoggingMiddleware, after its
    `bound_contextvars(request_id=...)` block has already unwound. Two things must hold: (1) only
    ONE of the two log lines this request produces renders a traceback (the middleware's own access
    log must not re-render it), and (2) that traceback-carrying line still has the request id, even
    though it's logged from outside the middleware's contextvar scope.
    """
    root_logger = logging.getLogger()
    saved_handlers, saved_level = root_logger.handlers[:], root_logger.level
    try:
        configure_logging()  # rebinds stdout so capsys can capture real JSON log lines

        app = FastAPI()
        app.add_middleware(RequestLoggingMiddleware)
        register_error_handlers(app)

        @app.get("/boom")
        async def boom() -> None:
            raise RuntimeError("boom")

        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/boom", headers={"X-Request-ID": "test-request-id"})

        assert response.status_code == 500
        # The 500 envelope, not a response header, is how the request id reaches the client here —
        # the middleware only echoes X-Request-ID on the success path (response.headers is never
        # populated for a path that never returns a response object to it).
        assert response.json()["error"]["request_id"] == "test-request-id"

        lines = [json.loads(line) for line in capsys.readouterr().out.strip().splitlines()]
        traceback_lines = [line for line in lines if "exception" in line]

        assert len(traceback_lines) == 1, "expected exactly one rendered traceback for this request"
        assert traceback_lines[0]["event"] == "unhandled_error"
        assert traceback_lines[0]["request_id"] == "test-request-id"
        assert "RuntimeError: boom" in traceback_lines[0]["exception"]

        access_lines = [line for line in lines if line["event"] == "http_access"]
        assert len(access_lines) == 1
        assert access_lines[0]["status"] == 500
        assert access_lines[0]["request_id"] == "test-request-id"
        assert "exception" not in access_lines[0]
    finally:
        root_logger.handlers, root_logger.level = saved_handlers, saved_level
