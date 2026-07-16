"""
Purpose:   Unit: OpenAILLMClient retry/backoff behaviour, shared by generate() (RAG) and
           analyze_image() (vision). Proves a transient error (429/5xx/timeout/connection) is
           retried up to 2 times with the actual retry count reported back, a non-transient error
           (e.g. 400) is never retried, and analyze_image() now retries too — before this adapter
           existed, VisionService's own vision call had zero retries on any API error.
Layer:     test
May import:   pytest, app.components.llm, openai (exception types only, to build fakes), httpx,
              stdlib
Must NOT import:  live network
"""
from __future__ import annotations

import asyncio
from types import SimpleNamespace

import httpx
import pytest
from openai import APIConnectionError, APIStatusError, APITimeoutError

from app.components.llm import OpenAILLMClient

_REQUEST = httpx.Request("POST", "https://api.openai.com/v1/chat/completions")


def _status_error(status_code: int) -> APIStatusError:
    response = httpx.Response(status_code, request=_REQUEST)
    return APIStatusError("boom", response=response, body=None)


class _FakeCompletions:
    """Stands in for client.chat.completions: raises the scripted errors in order, then succeeds."""

    def __init__(self, failures: list[BaseException], content: str = "answer") -> None:
        self._failures = list(failures)
        self._content = content
        self.calls = 0

    async def create(self, **_kwargs: object) -> object:
        self.calls += 1
        if self._failures:
            raise self._failures.pop(0)
        message = SimpleNamespace(content=self._content)
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])


def _make_client(monkeypatch: pytest.MonkeyPatch, completions: _FakeCompletions) -> OpenAILLMClient:
    fake_openai_client = SimpleNamespace(chat=SimpleNamespace(completions=completions))
    monkeypatch.setattr("app.components.llm.DefaultAioHttpClient", lambda: object())
    monkeypatch.setattr("app.components.llm.AsyncOpenAI", lambda **_kwargs: fake_openai_client)
    monkeypatch.setattr(asyncio, "sleep", _no_sleep)  # skip the real backoff delay in tests
    return OpenAILLMClient(api_key="test-key", model="gpt-4o-mini")


async def _no_sleep(_seconds: float) -> None:
    return None


async def test_generate_succeeds_first_try_reports_zero_retries(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    completions = _FakeCompletions([], content="hello")
    client = _make_client(monkeypatch, completions)

    text, retries = await client.generate(
        "prompt", temperature=0.3, max_tokens=100, timeout_s=5.0
    )

    assert text == "hello"
    assert retries == 0
    assert completions.calls == 1


async def test_generate_retries_transient_status_then_succeeds(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    completions = _FakeCompletions([_status_error(503)], content="recovered")
    client = _make_client(monkeypatch, completions)

    text, retries = await client.generate(
        "prompt", temperature=0.3, max_tokens=100, timeout_s=5.0
    )

    assert text == "recovered"
    assert retries == 1
    assert completions.calls == 2


async def test_generate_raises_after_exhausting_retries(monkeypatch: pytest.MonkeyPatch) -> None:
    completions = _FakeCompletions([_status_error(503), _status_error(503), _status_error(503)])
    client = _make_client(monkeypatch, completions)

    with pytest.raises(APIStatusError):
        await client.generate("prompt", temperature=0.3, max_tokens=100, timeout_s=5.0)
    assert completions.calls == 3  # initial attempt + 2 retries, then give up


async def test_generate_does_not_retry_non_transient_status(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    completions = _FakeCompletions([_status_error(400)])
    client = _make_client(monkeypatch, completions)

    with pytest.raises(APIStatusError):
        await client.generate("prompt", temperature=0.3, max_tokens=100, timeout_s=5.0)
    assert completions.calls == 1  # non-transient -> no retry


async def test_generate_retries_on_connection_error(monkeypatch: pytest.MonkeyPatch) -> None:
    completions = _FakeCompletions(
        [APIConnectionError(request=_REQUEST)], content="reconnected"
    )
    client = _make_client(monkeypatch, completions)

    text, retries = await client.generate(
        "prompt", temperature=0.3, max_tokens=100, timeout_s=5.0
    )

    assert text == "reconnected"
    assert retries == 1


async def test_analyze_image_retries_on_transient_error(monkeypatch: pytest.MonkeyPatch) -> None:
    """The regression test: before OpenAILLMClient existed, VisionService called the OpenAI SDK
    directly with no retry loop at all, so a single transient error went straight to the
    is_valid:false fallback. Vision now shares the same retrying adapter as RAG generation."""
    completions = _FakeCompletions([_status_error(500)], content='{"is_valid": true}')
    client = _make_client(monkeypatch, completions)

    raw, retries = await client.analyze_image(
        b"\xff\xd8\xff\xe0fake-jpeg-bytes",
        "image/jpeg",
        "describe the image",
        temperature=0.1,
        max_tokens=100,
        timeout_s=5.0,
    )

    assert raw == '{"is_valid": true}'
    assert retries == 1
    assert completions.calls == 2


async def test_analyze_image_raises_immediately_on_timeout_and_reports_zero_retries_used(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    completions = _FakeCompletions([APITimeoutError(_REQUEST)] * 3)
    client = _make_client(monkeypatch, completions)

    with pytest.raises(APITimeoutError):
        await client.analyze_image(
            b"bytes", "image/png", "prompt", temperature=0.1, max_tokens=100, timeout_s=5.0
        )
    assert completions.calls == 3
