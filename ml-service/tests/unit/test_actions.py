"""
Purpose:   Unit: KNOWN_ACTIONS is the single source of truth for registered action names, used
           both to build the classification prompt and to validate a parsed action_intent.
Layer:     test
May import:   pytest, app.domain.actions
Must NOT import:  asyncpg, openai, FastAPI
"""
from __future__ import annotations

from app.domain.actions import KNOWN_ACTIONS


def test_create_appeal_is_a_known_action() -> None:
    assert "create_appeal" in KNOWN_ACTIONS


def test_every_known_action_has_a_non_empty_trigger_description() -> None:
    for name, description in KNOWN_ACTIONS.items():
        assert isinstance(name, str) and name
        assert isinstance(description, str) and description.strip()
