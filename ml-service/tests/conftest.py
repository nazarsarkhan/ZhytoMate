"""
Purpose:   Shared pytest fixtures: testcontainers Postgres, FastAPI TestClient, DI overrides swapping components for fakes.
Layer:     test
May import:   pytest, testcontainers, FastAPI TestClient, app.main, app.deps,
              app.observability.logging, tests.fakes/*
Must NOT import:  (nothing in app/* may import tests/* — tests are leaves)
"""
from __future__ import annotations

from app.observability.logging import configure_logging

# Configure once for the whole test session, not just when a test happens to boot the FastAPI
# lifespan (most unit tests never touch app.main at all). Without this, structlog stays on its
# un-configured default (a standalone PrintLogger that never becomes a stdlib LogRecord), so
# pytest's caplog fixture — which hooks stdlib logging — would silently capture nothing.
configure_logging()
