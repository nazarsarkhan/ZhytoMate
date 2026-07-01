"""
Purpose:   Unit: configure_logging() actually produces valid JSON lines on stdout, and routes
           through stdlib logging (not a standalone PrintLogger) so pytest's caplog fixture keeps
           working for every structlog.get_logger() call in the app.
Layer:     test
May import:   pytest, structlog, app.observability.logging, stdlib
Must NOT import:  live network
"""
from __future__ import annotations

import json
import logging

import pytest
import structlog

from app.observability.logging import configure_logging


def test_configure_logging_emits_json_to_stdout(capsys: pytest.CaptureFixture[str]) -> None:
    root_logger = logging.getLogger()
    saved_handlers, saved_level = root_logger.handlers[:], root_logger.level
    try:
        configure_logging()  # rebinds the handler to capsys's current sys.stdout
        logger = structlog.get_logger("test.logging_config")
        logger.info("test_event", foo="bar")

        line = capsys.readouterr().out.strip().splitlines()[-1]
        payload = json.loads(line)

        assert payload["event"] == "test_event"
        assert payload["foo"] == "bar"
        assert payload["level"] == "info"
        assert "timestamp" in payload
    finally:
        root_logger.handlers, root_logger.level = saved_handlers, saved_level


def test_configure_logging_routes_through_stdlib_so_caplog_still_works(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """The whole point of choosing stdlib.LoggerFactory + ProcessorFormatter over a standalone
    PrintLogger: caplog hooks stdlib logging, so every structlog call in the app must still reach
    it for existing warning-log tests (e.g. tests/unit/test_agent_pipeline.py) to keep working.

    Deliberately does NOT call configure_logging() here: caplog's fixture setup attaches its own
    handler to the root logger before this test body runs, and configure_logging() replaces
    root-logger handlers wholesale (by design — see its docstring), which would wipe caplog's
    handler right back out. Relying on tests/conftest.py's one-off session-start call is exactly
    the real-world scenario for every OTHER logger in the app (they never call configure_logging()
    themselves either), so this is the representative way to prove the interop holds up."""
    logger = structlog.get_logger("test.logging_config")

    with caplog.at_level("WARNING"):
        logger.warning(
            "agent_retrieve_failed", subquery="Коли вивезуть сміття?", err="RuntimeError"
        )

    assert "Коли вивезуть сміття?" in caplog.text
    assert "RuntimeError" in caplog.text


def test_configure_logging_renders_exception_traceback_in_json(
    capsys: pytest.CaptureFixture[str],
) -> None:
    root_logger = logging.getLogger()
    saved_handlers, saved_level = root_logger.handlers[:], root_logger.level
    try:
        configure_logging()
        logger = structlog.get_logger("test.logging_config")
        try:
            raise RuntimeError("boom")
        except RuntimeError:
            logger.exception("unhandled_error", method="GET", path="/x")

        line = capsys.readouterr().out.strip().splitlines()[-1]
        payload = json.loads(line)

        assert payload["event"] == "unhandled_error"
        assert payload["level"] == "error"
        assert "RuntimeError: boom" in payload["exception"]
    finally:
        root_logger.handlers, root_logger.level = saved_handlers, saved_level
