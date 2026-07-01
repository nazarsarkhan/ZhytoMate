"""
Purpose:   Unit: Embedder.encode_query's LRU cache — a miss calls the OpenAI API and records a
           lookup (no hit); a subsequent hit for the same (normalized) text skips the API call and
           records both a lookup and a hit. Mirrors test_llm_client.py's fake-completions pattern
           for the OpenAI SDK surface, adapted to embeddings.create.
Layer:     test
May import:   pytest, app.components.embedder, app.metrics, stdlib
Must NOT import:  live network
"""
from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.components.embedder import Embedder
from app.metrics import embedding_cache_hits_total, embedding_cache_lookups_total


class _FakeEmbeddings:
    """Stands in for client.embeddings: returns one fixed-length vector per input text."""

    def __init__(self) -> None:
        self.calls = 0

    async def create(self, *, model: str, input: list[str], dimensions: int) -> object:
        self.calls += 1
        data = [SimpleNamespace(embedding=[1.0] * dimensions) for _ in input]
        return SimpleNamespace(data=data)


def _make_embedder(monkeypatch: pytest.MonkeyPatch, embeddings: _FakeEmbeddings) -> Embedder:
    fake_openai_client = SimpleNamespace(embeddings=embeddings)
    monkeypatch.setattr("app.components.embedder.AsyncOpenAI", lambda api_key: fake_openai_client)
    return Embedder(api_key="test-key", model="text-embedding-3-large")


def _counter_value(counter) -> float:
    return counter._value.get()  # noqa: SLF001 — prometheus_client exposes no public reader


async def test_encode_query_cache_miss_counts_a_lookup_but_not_a_hit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    embedder = _make_embedder(monkeypatch, _FakeEmbeddings())
    lookups_before = _counter_value(embedding_cache_lookups_total)
    hits_before = _counter_value(embedding_cache_hits_total)

    await embedder.encode_query("Коли вивезуть сміття?")

    assert _counter_value(embedding_cache_lookups_total) == lookups_before + 1
    assert _counter_value(embedding_cache_hits_total) == hits_before


async def test_encode_query_cache_hit_counts_both_a_lookup_and_a_hit_and_skips_the_api_call(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    embeddings = _FakeEmbeddings()
    embedder = _make_embedder(monkeypatch, embeddings)
    await embedder.encode_query("Коли вивезуть сміття?")
    assert embeddings.calls == 1

    lookups_before = _counter_value(embedding_cache_lookups_total)
    hits_before = _counter_value(embedding_cache_hits_total)

    await embedder.encode_query("Коли вивезуть сміття?")  # same text -> cache hit

    assert embeddings.calls == 1  # no second API call
    assert _counter_value(embedding_cache_lookups_total) == lookups_before + 1
    assert _counter_value(embedding_cache_hits_total) == hits_before + 1
