"""
Purpose:   Reuses tests/integration/conftest.py's real-Postgres fixtures (pg_container, pg_pool,
           clean_tables) for tests/eval — a sibling directory that pytest's conftest chain does not
           reach on its own (fixture visibility follows the directory hierarchy of the test being
           collected, and tests/eval/ is not a subdirectory of tests/integration/). This is a plain
           Python import, not `pytest_plugins` (registering plugins that way from a non-root
           conftest.py is unsupported): tests/ has no __init__.py anywhere and works as a PEP 420
           namespace package already (tests/integration/test_repository.py imports
           tests.integration.conftest the same way), and importing fixture-marked functions into
           this module's namespace is enough for pytest's fixture discovery to find them here too.
Layer:     test
May import:   tests.integration.conftest
Must NOT import:  (nothing in app/* may import tests/*)
"""
from __future__ import annotations

from tests.integration.conftest import (  # noqa: F401 — re-exported for pytest fixture discovery
    clean_tables,
    pg_container,
    pg_pool,
)
