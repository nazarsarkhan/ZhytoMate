"""
Purpose:   Structured JSON logging setup; user_id always logged hashed, user_query only at DEBUG.
Layer:     observability
May import:   stdlib logging / structlog
Must NOT import:  api/*, services/*, components/*, domain/*
"""
from __future__ import annotations

import logging
import sys

import structlog

# Shared by both structlog-originated records (via the main `processors` chain) and plain stdlib
# records from third-party libraries (uvicorn, asyncpg, ...) that never go through structlog at all
# — `foreign_pre_chain` below runs these same steps on those before final rendering, so every line
# on stdout gets the same level/timestamp shape.
_SHARED_PROCESSORS = [
    structlog.contextvars.merge_contextvars,
    structlog.stdlib.add_log_level,
    structlog.processors.TimeStamper(fmt="iso"),
]


def configure_logging() -> None:
    """One-time logging setup: JSON lines on stdout, request-id (and any other bound contextvar)
    merged into every line automatically. Call once at process startup, before the app starts
    serving.

    Routes through the stdlib `logging` module (structlog.stdlib.LoggerFactory +
    ProcessorFormatter) rather than structlog's standalone PrintLogger: every
    `structlog.get_logger()` call ends up as a real stdlib LogRecord, so pytest's `caplog` fixture
    (which hooks stdlib logging) keeps working for every logger in the app, and third-party
    libraries that log via plain stdlib `logging` are rendered through the same JSON formatter.
    """
    structlog.configure(
        processors=[
            *_SHARED_PROCESSORS,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=_SHARED_PROCESSORS,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            structlog.processors.JSONRenderer(),
        ],
    )
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers = [handler]  # replace, not append — configure_logging() is idempotent
    root_logger.setLevel(logging.INFO)
