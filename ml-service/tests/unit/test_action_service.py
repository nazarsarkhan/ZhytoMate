"""
Purpose:   Unit: ActionService.extract_slots — merges newly-extracted slots over current_slots on a
           genuine key collision (never drops an already-filled field the model didn't re-mention,
           and never lets a stale value survive one the model DID re-mention), freezes `slots` to
           current_slots whenever the model marks is_unrelated (even if that same reply's `slots`
           object disagrees), and passes through wants_cancel. Also covers SlotExtractionRequest/
           SlotFieldSchema's input caps (current_slots key count + value length, enum_values item
           count + length) — mirrors test_vision.py's pattern of testing a service and its request
           schema's validation together in one file. Uses FakeGenerator, no real LLM.
Layer:     test
May import:   pytest, pydantic, app.services.action_service, app.schemas.actions,
              tests.fakes.fake_generator
Must NOT import:  real openai
"""
from __future__ import annotations

import json

import pytest
from pydantic import ValidationError

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


async def test_extract_slots_new_value_overwrites_colliding_key() -> None:
    """Proves the merge direction on a genuine key collision: newly extracted data must win over
    a stale current_slots value (the entire point of a multi-turn slot-filling loop). The merge
    test above only uses disjoint keys, so it can't distinguish {**current, **extracted} from the
    reversed {**extracted, **current} — both produce the same result when keys never collide."""
    scripted = {
        "slots": {"address": "нова адреса"},
        "wants_cancel": False,
        "is_unrelated": False,
    }
    generator = FakeGenerator(result=(json.dumps(scripted), 0))
    service = ActionService(generator)
    request = SlotExtractionRequest(
        message="Насправді адреса інша",
        slot_schema=_SCHEMA,
        current_slots={"address": "стара адреса"},
    )

    result = await service.extract_slots(request)

    assert result.slots["address"] == "нова адреса"


async def test_extract_slots_freezes_slots_when_model_marks_unrelated_anyway() -> None:
    """Defense in depth: the prompt asks the model to return `slots` unchanged whenever
    is_unrelated is true, but nothing before this fix enforced that in code. This scripts a reply
    that violates the prompt's own instruction — is_unrelated: true alongside a changed AND an
    added field in `slots` — and confirms the service ignores that stray extraction entirely
    rather than silently merging it in."""
    scripted = {
        "slots": {"category": "garbage", "address": "щось нове"},
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


def test_current_slots_over_max_keys_is_rejected() -> None:
    """current_slots accumulates across many conversation turns and is serialized directly into
    the LLM prompt — an unbounded key count is a real path to runaway prompt size."""
    oversized = {f"field_{i}": "value" for i in range(21)}
    with pytest.raises(ValidationError):
        SlotExtractionRequest(message="щось", slot_schema=_SCHEMA, current_slots=oversized)


def test_current_slots_value_over_max_length_is_rejected() -> None:
    with pytest.raises(ValidationError):
        SlotExtractionRequest(
            message="щось", slot_schema=_SCHEMA, current_slots={"address": "x" * 501}
        )


def test_enum_values_over_max_count_is_rejected() -> None:
    with pytest.raises(ValidationError):
        SlotFieldSchema(
            name="category", description="Категорія", enum_values=[f"v{i}" for i in range(51)]
        )


def test_enum_values_item_over_max_length_is_rejected() -> None:
    with pytest.raises(ValidationError):
        SlotFieldSchema(name="category", description="Категорія", enum_values=["x" * 65])
