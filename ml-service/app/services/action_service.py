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
           service). Every merged value is also clamped to MAX_SLOT_VALUE_LENGTH before it's
           returned — SlotExtractionRequest.current_slots enforces that same cap on input, so an
           unclamped LLM-extracted value could otherwise round-trip back in as a future request and
           fail that validation forever, permanently wedging the caller's draft. Emits
           llm_calls/llm_latency_seconds the same way vision_service.py and
           pipeline.base.run_shared_tail do (route="actions"), so this LLM-calling path is covered
           by the same dashboards/alerts as every other one.
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
from app.metrics import llm_calls, llm_latency_seconds
from app.protocols import Generator
from app.schemas.actions import MAX_SLOT_VALUE_LENGTH, SlotExtractionRequest, SlotExtractionResponse

logger = structlog.get_logger(__name__)

_EXTRACTION_TEMPERATURE = 0.0
_EXTRACTION_MAX_TOKENS = 512
_EXTRACTION_TIMEOUT_S = 8.0
_METRICS_ROUTE = "actions"


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
            merged = (
                dict(request.current_slots)
                if is_unrelated
                else {**request.current_slots, **extracted}
            )
            # extracted comes straight from the LLM's JSON reply, bounded only by
            # _EXTRACTION_MAX_TOKENS for the whole response — a single field can still exceed
            # MAX_SLOT_VALUE_LENGTH. Left unclamped, that value would be persisted by the caller as
            # this draft's current_slots and re-sent on the next turn, where it fails
            # SlotExtractionRequest's own validation — permanently wedging the draft, since a failed
            # request never reaches this method again to self-correct. Clamped here, after both
            # branches above converge, so it also covers is_unrelated's copy-forward path.
            overlong = [key for key, value in merged.items() if len(value) > MAX_SLOT_VALUE_LENGTH]
            if overlong:
                logger.warning("slot_extraction_value_truncated", fields=overlong)
                merged = {key: value[:MAX_SLOT_VALUE_LENGTH] for key, value in merged.items()}
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
