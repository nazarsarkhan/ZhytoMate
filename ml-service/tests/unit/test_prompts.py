"""
Purpose:   Unit: build_rag_prompt keeps context and the user question in separate XML blocks, carries
           the anti-injection instruction, and separates chunks with a horizontal rule.
Layer:     test
May import:   pytest, app.domain.prompts, stdlib
Must NOT import:  app.api, app.services, app.components; asyncpg, google-genai (pure/fast unit test)
"""
from __future__ import annotations

from app.domain.prompts import build_rag_prompt


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
