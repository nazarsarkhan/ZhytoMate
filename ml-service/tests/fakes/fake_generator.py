"""
Purpose:   Scriptable fake implementing both protocols.Generator and protocols.VisionGenerator:
           construct with a single canned (text, retry_count) result (or exception) returned on
           every call, OR a `results` queue — a list of per-call items, each either a (text,
           retry_count) tuple or an exception instance — consumed in order, letting a test script a
           sequence of distinct LLM turns (e.g. a decompose call that succeeds followed by a
           synthesis call that raises). Once the queue is exhausted, further calls fall back to the
           single `result`/`error` behavior. Keeps CI offline — no real LLM calls.
Layer:     test
May import:   stdlib, app.protocols (the ABCs it implements)
Must NOT import:  openai (the whole point is to avoid the real LLM in CI)
"""
from __future__ import annotations

from app.protocols import Generator, VisionGenerator


class FakeGenerator(Generator, VisionGenerator):
    """Records every prompt/image it receives; returns the next scripted result or raises the next
    scripted error. One instance can back both RagService/pipelines and VisionService in a test."""

    def __init__(
        self,
        *,
        result: tuple[str, int] = ("stubbed answer", 0),
        results: list[tuple[str, int] | BaseException] | None = None,
        error: BaseException | None = None,
    ) -> None:
        self._result = result
        self._results: list[tuple[str, int] | BaseException] | None = (
            list(results) if results is not None else None
        )
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
        return self._next_result()

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
        return self._next_result()

    def _next_result(self) -> tuple[str, int]:
        """Pops the next scripted item when `results` was given; otherwise (or once the queue is
        exhausted) falls back to the single `result`/`error` on every subsequent call."""
        if self._results:
            item = self._results.pop(0)
            if isinstance(item, BaseException):
                raise item
            return item
        if self._error is not None:
            raise self._error
        return self._result
