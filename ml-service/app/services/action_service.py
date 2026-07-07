"""
Purpose:   ActionService.extract_slots — generic structured-extraction over a caller-supplied slot
           schema (§ assistant actions framework design). Never persists anything, never knows what
           the fields mean beyond their description strings; backend_app owns all domain logic
           (what an "appeal" is, what to do once slots are filled). Fails closed to
           is_unrelated=True on any parse/call failure, never silently inventing or dropping slot
           data — the caller's draft state must stay exactly as it was before a failed extraction.
           That same guarantee is enforced against the model's own reply, not just call/parse
           failures: an is_unrelated=true reply freezes `slots` to exactly current_slots regardless
           of what that reply's `slots` object contains, so a model that sets is_unrelated but
           still (incorrectly) changes a field can never sneak that change past the caller — the
           prompt asks for this too, but code enforcement is the real guarantee (defense in depth,
           the same posture as the OPSEC gate / never-answer-in-Russian policy elsewhere in this
           service). Two more guarantees hold against the model's reply for the same reason:
           _filter_undeclared_slots drops any key outside slot_schema, and _clamp_value_lengths
           caps every value at MAX_SLOT_VALUE_LENGTH, both before the response is returned.
           current_slots enforces this exact item-count cap and per-value length cap on input, so
           an unfiltered/unclamped reply could otherwise round-trip back in as a future request and
           fail that same validation forever, permanently wedging the caller's draft. Both
           anomalies are logged and counted (slot_extraction_anomalies_total, kind=unexpected_key|
           value_truncated) alongside the existing llm_calls/llm_latency_seconds emitted the same
           way vision_service.py and pipeline.base.run_shared_tail do (route="actions"), so this
           LLM-calling path is covered by the same dashboards/alerts as every other one.
Layer:     service
May import:   domain/prompts, schemas/actions, app.protocols (Generator port), app.metrics,
              structlog
Must NOT import:  other services/*, api/*, FastAPI/Starlette, asyncpg, openai directly
"""
from __future__ import annotations

import json
import time

import structlog

from app.domain.prompts import build_slot_extraction_prompt
from app.metrics import llm_calls, llm_latency_seconds, slot_extraction_anomalies_total
from app.protocols import Generator
from app.schemas.actions import MAX_SLOT_VALUE_LENGTH, SlotExtractionRequest, SlotExtractionResponse

logger = structlog.get_logger(__name__)

_EXTRACTION_TEMPERATURE = 0.0
_EXTRACTION_MAX_TOKENS = 512
_EXTRACTION_TIMEOUT_S = 8.0
_METRICS_ROUTE = "actions"


def _filter_undeclared_slots(
    extracted: dict[str, str], declared_fields: set[str]
) -> dict[str, str]:
    """Drops any key the model hallucinated outside slot_schema. Merged in, an undeclared key is
    the same round-trip hazard as an oversized value (see _clamp_value_lengths below): persisted
    by the caller as this draft's current_slots, it would breach that field's own max_length=20
    item cap once enough stray keys accumulate across turns, permanently wedging the draft the
    same way. Filtering here removes the hazard outright instead of merely bounding it."""
    unexpected_keys = [key for key in extracted if key not in declared_fields]
    if unexpected_keys:
        logger.warning("slot_extraction_unexpected_key", fields=unexpected_keys)
        slot_extraction_anomalies_total.labels(kind="unexpected_key").inc(len(unexpected_keys))
    return {key: value for key, value in extracted.items() if key in declared_fields}


def _clamp_value_lengths(merged: dict[str, str]) -> dict[str, str]:
    """extracted comes straight from the LLM's JSON reply, bounded only by _EXTRACTION_MAX_TOKENS
    for the whole response — a single field can still exceed MAX_SLOT_VALUE_LENGTH. Left
    unclamped, that value would be persisted by the caller as this draft's current_slots and
    re-sent on the next turn, where it fails SlotExtractionRequest's own validation — permanently
    wedging the draft, since a failed request never reaches extract_slots again to self-correct."""
    overlong = [key for key, value in merged.items() if len(value) > MAX_SLOT_VALUE_LENGTH]
    if not overlong:
        return merged
    logger.warning("slot_extraction_value_truncated", fields=overlong)
    slot_extraction_anomalies_total.labels(kind="value_truncated").inc(len(overlong))
    return {key: value[:MAX_SLOT_VALUE_LENGTH] for key, value in merged.items()}


class ActionService:
    def __init__(self, generator: Generator) -> None:
        self._generator = generator

    async def extract_slots(self, request: SlotExtractionRequest) -> SlotExtractionResponse:
        prompt = build_slot_extraction_prompt(
            message=request.message,
            slot_schema=request.slot_schema,
            current_slots=request.current_slots,
        )
        llm_start = time.perf_counter()
        try:
            raw, _ = await self._generator.generate(
                prompt,
                temperature=_EXTRACTION_TEMPERATURE,
                max_tokens=_EXTRACTION_MAX_TOKENS,
                timeout_s=_EXTRACTION_TIMEOUT_S,
                json_mode=True,
            )
            parsed = json.loads(raw[raw.find("{") : raw.rfind("}") + 1])
            extracted = parsed.get("slots")
            if not isinstance(extracted, dict):
                raise ValueError("slots field missing or not an object")
            # is_unrelated freezes slots to exactly current_slots — see the module docstring's
            # defense-in-depth note. Computed before the merge so the freeze can short-circuit it.
            is_unrelated = parsed.get("is_unrelated") is True
            if not is_unrelated:
                # Only filtered/logged/counted when it would actually reach `merged` below —
                # is_unrelated discards `extracted` entirely regardless, so a stray key there was
                # never a real anomaly worth flagging.
                declared_fields = {field.name for field in request.slot_schema}
                extracted = _filter_undeclared_slots(extracted, declared_fields)
            merged = (
                dict(request.current_slots)
                if is_unrelated
                else {**request.current_slots, **extracted}
            )
            # Clamped after both branches above converge, so this also covers is_unrelated's
            # copy-forward path — current_slots is already validated to this same cap on the way
            # in, so that path never actually trips it today, but the guarantee stays unconditional
            # rather than depending on which branch built `merged`.
            merged = _clamp_value_lengths(merged)
            llm_calls.labels(route=_METRICS_ROUTE, outcome="ok").inc()
            return SlotExtractionResponse(
                slots=merged,
                wants_cancel=parsed.get("wants_cancel") is True,
                is_unrelated=is_unrelated,
            )
        except Exception as exc:  # noqa: BLE001 — fail closed: never invent/drop slot data
            logger.warning("slot_extraction_failed", err=type(exc).__name__)
            llm_calls.labels(route=_METRICS_ROUTE, outcome="fallback").inc()
            return SlotExtractionResponse(
                slots=dict(request.current_slots), wants_cancel=False, is_unrelated=True
            )
        finally:
            # Timed around the whole try/except (mirrors run_shared_tail) — a failed/timed-out
            # call's latency is just as operationally interesting as a successful one's.
            llm_latency_seconds.observe(time.perf_counter() - llm_start)
