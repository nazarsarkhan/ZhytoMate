"""
Purpose:   Unit: build_rag_prompt keeps context and the user question in separate XML blocks, carries
           the anti-injection instruction, and separates chunks with a horizontal rule.
           build_decompose_prompt/build_rewrite_prompt: the question text survives verbatim, the
           decompose prompt names the max sub-query count and demands JSON-only output, the rewrite
           prompt demands question-only output.
Layer:     test
May import:   pytest, app.domain.prompts, stdlib
Must NOT import:  app.api, app.services, app.components; asyncpg, openai (pure/fast unit test)
"""
from __future__ import annotations

from app.domain.prompts import build_decompose_prompt, build_rag_prompt, build_rewrite_prompt


def test_build_prompt_contains_delimiters() -> None:
    prompt = build_rag_prompt(["Воду дадуть у вівторок."], "Коли буде вода?")
    assert "<context>" in prompt and "</context>" in prompt
    assert "<question>" in prompt and "</question>" in prompt


def test_build_prompt_chunks_separated() -> None:
    prompt = build_rag_prompt(["перший фрагмент", "другий фрагмент"], "питання")
    assert "---" in prompt
    assert "перший фрагмент" in prompt and "другий фрагмент" in prompt


def test_build_prompt_carries_question_verbatim() -> None:
    question = "Коли дадуть світло?"
    prompt = build_rag_prompt(["контекст"], question)
    assert question in prompt
    # The real question block follows the closed context block (the instruction also names the
    # tags, so assert on the exact block structure rather than a first-occurrence index).
    assert f"</context>\n\n<question>\n{question}\n</question>" in prompt


def test_build_decompose_prompt_carries_query_and_max_subqueries() -> None:
    query = "Коли вивезуть сміття і коли ввімкнуть світло?"
    prompt = build_decompose_prompt(query, max_subqueries=3)
    assert f"<question>\n{query}\n</question>" in prompt
    assert "3" in prompt


def test_build_decompose_prompt_demands_json_only_output() -> None:
    prompt = build_decompose_prompt("питання", max_subqueries=3)
    assert "JSON" in prompt
    assert "markdown" in prompt.lower()  # explicitly forbids fenced code blocks in the reply


def test_build_rewrite_prompt_carries_subquery_verbatim() -> None:
    subquery = "Коли вивезуть сміття?"
    prompt = build_rewrite_prompt(subquery)
    assert f"<question>\n{subquery}\n</question>" in prompt


def test_build_rewrite_prompt_demands_question_only_output() -> None:
    prompt = build_rewrite_prompt("питання")
    assert "без пояснень" in prompt
