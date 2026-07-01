"""
Purpose:   Scriptable fake implementing both protocols.Generator and protocols.VisionGenerator:
           construct with a canned (text, retry_count) result to return, or an exception instance to
           raise on every call, so flow tests can exercise both the happy path and the
           extractive/is_valid:false fallback path. Keeps CI offline — no real LLM calls.
Layer:     test
May import:   stdlib, app.protocols (the ABCs it implements)
Must NOT import:  openai (the whole point is to avoid the real LLM in CI)
"""
from __future__ import annotations

from app.protocols import Generator, VisionGenerator


class FakeGenerator(Generator, VisionGenerator):
    """Records every prompt/image it receives; returns the canned result or raises the canned
    error. One instance can back both RagService and VisionService in a test."""

    def __init__(
        self,
        *,
        result: tuple[str, int] = ("stubbed answer", 0),
        error: BaseException | None = None,
    ) -> None:
        self._result = result
        self._error = error
        self.generate_calls: list[str] = []
        self.analyze_calls: list[tuple[bytes, str, str]] = []

    @property
    def call_count(self) -> int:
        """Total calls across both ports — flows assert on this to prove/disprove an LLM call."""
        return len(self.generate_calls) + len(self.analyze_calls)

    async def generate(
        self, prompt: str, *, temperature: float, max_tokens: int, timeout_s: float
    ) -> tuple[str, int]:
        self.generate_calls.append(prompt)
        if self._error is not None:
            raise self._error
        return self._result

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
        self.analyze_calls.append((image_bytes, mime_type, prompt))
        if self._error is not None:
            raise self._error
        return self._result
