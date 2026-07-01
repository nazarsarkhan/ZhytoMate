"""
Purpose:   Unit: RequestLoggingMiddleware's externally-observable X-Request-ID header contract —
           accept-or-generate, echoed back on the response. app.errors._request_id and the rest of
           the system depend on request.state.request_id being populated correctly; the generic
           access-log line's content is not asserted here (that's covered by test_logging_config.py).
Layer:     test
May import:   pytest, fastapi.testclient, app.middleware
Must NOT import:  live network
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.middleware import RequestLoggingMiddleware


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
