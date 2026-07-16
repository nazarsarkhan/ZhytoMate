"""
Purpose:   OpenAI-backed LLM adapter: OpenAILLMClient implements protocols.Generator AND
           protocols.VisionGenerator with ONE openai.AsyncOpenAI client covering RAG generation,
           agent decompose/synthesis, and vision analysis. Owns every OpenAI-specific concern —
           the chat-completions call shape, json_object response format, and the base64 data-URL
           image encoding — so the ports themselves stay generic (prompt/bytes in, text + retry
           count out) and no OpenAI concept leaks into services/*. Timeouts + tenacity retry/backoff
           on transient errors only (429/5xx/timeout/connection). Model id + api key come from
           Settings/env ONLY (never committed — CLAUDE.md). Paid tier => rate-limiting no longer
           binds (ADR-003 rev / ADR-009 rev).
Layer:     component
May import:   app.protocols; openai (the one resource this wraps), tenacity
Must NOT import:  services/*, api/*, pipeline/*, other components/*
"""
from __future__ import annotations

import asyncio
import base64
import random
from collections.abc import Awaitable, Callable
from typing import TypeVar

from openai import APIConnectionError, APIError, APITimeoutError, AsyncOpenAI
from openai.types.chat.completion_create_params import ResponseFormat
from tenacity import AsyncRetrying, RetryCallState, retry_if_exception, stop_after_attempt

from app.protocols import Generator, VisionGenerator

_RETRYABLE_STATUS = frozenset({429, 500, 502, 503, 504})
_RETRY_BACKOFF_S = (0.5, 1.0)  # one delay per retry; len == number of retries
_MAX_ATTEMPTS = len(_RETRY_BACKOFF_S) + 1  # initial attempt + retries

_ResultT = TypeVar("_ResultT")


def _is_retryable_error(exc: BaseException) -> bool:
    """Transient classes only: timeouts/connection errors, or a 429/5xx API status."""
    if isinstance(exc, (APITimeoutError, APIConnectionError, asyncio.TimeoutError)):
        return True
    if isinstance(exc, APIError):
        return getattr(exc, "status_code", None) in _RETRYABLE_STATUS
    return False


def _backoff_wait(retry_state: RetryCallState) -> float:
    """Jittered backoff matching the pre-tenacity shape (~0.5s, then ~1.0s, ±20% jitter)."""
    index = min(retry_state.attempt_number - 1, len(_RETRY_BACKOFF_S) - 1)
    return _RETRY_BACKOFF_S[index] * random.uniform(0.8, 1.2)


class OpenAILLMClient(Generator, VisionGenerator):
    """One OpenAI client behind both LLM ports. Constructed once (in the lifespan) and shared
    across requests."""

    def __init__(self, api_key: str, model: str) -> None:
        self._client = AsyncOpenAI(api_key=api_key)
        self._model = model

    async def probe(self) -> None:
        """Perform a bounded dependency probe used by /health/deps."""
        await self._client.models.list()

    async def generate(
        self,
        prompt: str,
        *,
        temperature: float,
        max_tokens: int,
        timeout_s: float,
        json_mode: bool = False,
    ) -> tuple[str, int]:
        async def call() -> str:
            response_format: ResponseFormat = (
                {"type": "json_object"} if json_mode else {"type": "text"}
            )
            response = await self._client.chat.completions.create(
                model=self._model,
                messages=[{"role": "user", "content": prompt}],
                temperature=temperature,
                max_tokens=max_tokens,
                response_format=response_format,
            )
            return response.choices[0].message.content or ""

        return await self._call_with_retry(call, timeout_s=timeout_s)

    async def analyze_image(
        self,
        image_bytes: bytes,
        mime_type: str,
        prompt: str,
        *,
        temperature: float,
        max_tokens: int,
        timeout_s: float,
    ) -> tuple[str, int]:
        data_url = self._to_data_url(image_bytes, mime_type)

        async def call() -> str:
            response = await self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {"type": "image_url", "image_url": {"url": data_url}},
                        ],
                    }
                ],
                response_format={"type": "json_object"},
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return response.choices[0].message.content or ""

        return await self._call_with_retry(call, timeout_s=timeout_s)

    @staticmethod
    def _to_data_url(image_bytes: bytes, mime_type: str) -> str:
        encoded = base64.b64encode(image_bytes).decode()
        return f"data:{mime_type};base64,{encoded}"

    @staticmethod
    async def _call_with_retry(
        make_request: Callable[[], Awaitable[_ResultT]], *, timeout_s: float
    ) -> tuple[_ResultT, int]:
        """Runs make_request() with a per-attempt timeout and up to len(_RETRY_BACKOFF_S) retries on
        a transient error (429/5xx/timeout/connection). Returns (result, retry_count) — 0 when the
        first attempt succeeds. Re-raises the last exception once retries are exhausted, or
        immediately for a non-transient error."""
        attempts = 0
        async for attempt in AsyncRetrying(
            retry=retry_if_exception(_is_retryable_error),
            stop=stop_after_attempt(_MAX_ATTEMPTS),
            wait=_backoff_wait,
            reraise=True,
        ):
            attempts += 1
            with attempt:
                result = await asyncio.wait_for(make_request(), timeout=timeout_s)
            if not attempt.retry_state.outcome.failed:  # type: ignore[union-attr]
                return result, attempts - 1
        raise RuntimeError("unreachable: retry loop exhausted without return or raise")
