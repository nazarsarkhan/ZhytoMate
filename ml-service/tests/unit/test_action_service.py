"""
Purpose:   Unit: ActionService.extract_slots — merges newly-extracted slots over current_slots
           (never drops an already-filled field the model didn't re-mention), and passes through
           wants_cancel/is_unrelated. Uses FakeGenerator, no real LLM.
Layer:     test
May import:   pytest, app.services.action_service, app.schemas.actions, tests.fakes.fake_generator
Must NOT import:  real openai
"""
from __future__ import annotations

import json

from app.schemas.actions import SlotExtractionRequest, SlotFieldSchema
from app.services.action_service import ActionService
from tests.fakes.fake_generator import FakeGenerator

_SCHEMA = [
    SlotFieldSchema(name="category", description="Категорія", enum_values=["pothole", "garbage"]),
    SlotFieldSchema(name="address", description="Адреса"),
]


async def test_extract_slots_merges_new_fields_over_current() -> None:
    scripted = {
        "slots": {"address": "вул. Київська, 10"},
        "wants_cancel": False,
        "is_unrelated": False,
    }
    generator = FakeGenerator(result=(json.dumps(scripted), 0))
    service = ActionService(generator)
    request = SlotExtractionRequest(
        message="Адреса вул. Київська, 10",
        slot_schema=_SCHEMA,
        current_slots={"category": "pothole"},
    )

    result = await service.extract_slots(request)

    assert result.slots == {"category": "pothole", "address": "вул. Київська, 10"}
    assert result.wants_cancel is False
    assert result.is_unrelated is False


async def test_extract_slots_marks_unrelated_message() -> None:
    scripted = {
        "slots": {"category": "pothole"},
        "wants_cancel": False,
        "is_unrelated": True,
    }
    generator = FakeGenerator(result=(json.dumps(scripted), 0))
    service = ActionService(generator)
    request = SlotExtractionRequest(
        message="Яка погода сьогодні?",
        slot_schema=_SCHEMA,
        current_slots={"category": "pothole"},
    )

    result = await service.extract_slots(request)

    assert result.is_unrelated is True
    assert result.slots == {"category": "pothole"}


async def test_extract_slots_fails_closed_to_unrelated_on_malformed_reply() -> None:
    generator = FakeGenerator(result=("not json at all", 0))
    service = ActionService(generator)
    request = SlotExtractionRequest(message="щось", slot_schema=_SCHEMA, current_slots={})

    result = await service.extract_slots(request)

    # A malformed/failed extraction must never invent or drop data — treat it as unrelated so the
    # caller's draft stays exactly as it was, and the message falls through to a normal answer.
    assert result.is_unrelated is True
    assert result.wants_cancel is False
    assert result.slots == {}
