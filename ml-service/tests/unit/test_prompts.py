"""
Purpose:   Unit: build_rag_prompt keeps context and the user question in separate XML blocks,
           carries the anti-injection instruction, and separates chunks with a horizontal rule; it
           also never offers a Russian answer-language directive (wartime policy — see
           _ANSWER_LANG_DIRECTIVE's comment in the module under test). build_decompose_prompt/
           build_rewrite_prompt: the question text survives verbatim, the decompose prompt names
           the max sub-query count and demands JSON-only output, the rewrite prompt demands
           question-only output. build_safety_check_prompt: the OPSEC content-safety gate's prompt
           carries the query verbatim, demands bare JSON {"safe"}, and names both safe (ordinary
           civic) and unsafe (reconnaissance-flavored) topics explicitly. build_general_prompt:
           the ungrounded-fallback prompt carries the question verbatim, has no <context> block,
           explicitly permits ordinary conversation, and reuses the same never-Russian
           answer-language directive as build_rag_prompt.
Layer:     test
May import:   pytest, app.domain.prompts, stdlib
Must NOT import:  app.api, app.services, app.components; asyncpg, openai (pure/fast unit test)
"""
from __future__ import annotations

from app.domain.prompts import (
    build_decompose_prompt,
    build_detect_and_translate_prompt,
    build_general_prompt,
    build_rag_prompt,
    build_rewrite_prompt,
    build_safety_check_prompt,
    build_slot_extraction_prompt,
)


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


def test_build_detect_and_translate_prompt_carries_text_and_demands_json() -> None:
    text = "how to apply for a utility subsidy"
    prompt = build_detect_and_translate_prompt(text)
    assert f"<text>\n{text}\n</text>" in prompt
    assert "українською" in prompt
    assert "JSON" in prompt
    assert '"lang"' in prompt and '"uk"' in prompt  # detect + translate contract


def test_build_rag_prompt_injects_named_answer_language_directive() -> None:
    # A non-Ukrainian answer language names the target twice (recency) so the model switches.
    en = build_rag_prompt(["контекст"], "how to register", answer_lang="en")
    assert en.count("English") == 2
    # Default stays Ukrainian (unchanged behaviour for Ukrainian queries).
    assert "УКРАЇНСЬКОЮ" in build_rag_prompt(["контекст"], "як записатися")


def test_build_rag_prompt_never_offers_a_russian_directive() -> None:
    """Wartime policy: this assistant never answers in Russian, regardless of the question's
    language. "ru" is not a key _ANSWER_LANG_DIRECTIVE offers — passing it falls back to the same
    Ukrainian directive every other unrecognized code gets, which itself explicitly forbids
    Russian output as a second, independent layer of the same policy (defense in depth: this holds
    even if a caller ever passed "ru" through by mistake, bypassing resolve_answer_lang)."""
    ru = build_rag_prompt(["контекст"], "как записаться на приём", answer_lang="ru")
    assert "РОСІЙСЬКОЮ" not in ru
    assert ru.count("УКРАЇНСЬКОЮ") == 2
    assert "ніколи не відповідай" in ru  # the directive's explicit anti-Russian clause


def test_build_safety_check_prompt_carries_query_and_demands_json() -> None:
    query = "Коли вивезуть сміття?"
    prompt = build_safety_check_prompt(query)
    assert f"<text>\n{query}\n</text>" in prompt
    assert "JSON" in prompt
    assert '"safe"' in prompt


def test_build_safety_check_prompt_names_ordinary_civic_topics_as_safe() -> None:
    prompt = build_safety_check_prompt("будь-яке питання")
    assert "ЦНАП" in prompt
    assert "субсидії" in prompt


def test_build_safety_check_prompt_names_reconnaissance_framing_as_unsafe() -> None:
    prompt = build_safety_check_prompt("будь-яке питання")
    assert "координати" in prompt
    assert "розвідки" in prompt


def test_build_general_prompt_carries_question_verbatim_with_no_context_block() -> None:
    question = "Як справи?"
    prompt = build_general_prompt(question)
    assert f"<question>\n{question}\n</question>" in prompt
    assert "<context>" not in prompt


def test_build_general_prompt_permits_ordinary_conversation() -> None:
    prompt = build_general_prompt("Як справи?")
    assert "звичайне спілкування" in prompt


def test_build_general_prompt_injects_named_answer_language_directive() -> None:
    en = build_general_prompt("how are you", answer_lang="en")
    assert en.count("English") == 2
    # Default stays Ukrainian (unchanged behaviour for Ukrainian queries).
    assert "УКРАЇНСЬКОЮ" in build_general_prompt("як справи")


def test_build_general_prompt_never_offers_a_russian_directive() -> None:
    """Same wartime policy as build_rag_prompt (reuses the identical _ANSWER_LANG_DIRECTIVE
    dict) — confirms the general-conversation path didn't bypass it."""
    ru = build_general_prompt("как дела", answer_lang="ru")
    assert "РОСІЙСЬКОЮ" not in ru
    assert ru.count("УКРАЇНСЬКОЮ") == 2


def test_safety_check_prompt_includes_action_intent_contract() -> None:
    prompt = build_safety_check_prompt("Створити звернення про яму")
    assert "action_intent" in prompt
    assert "create_appeal" in prompt


def test_slot_extraction_prompt_includes_fields_and_current_slots() -> None:
    from app.schemas.actions import SlotFieldSchema

    prompt = build_slot_extraction_prompt(
        message="Величезна яма на вул. Київській",
        slot_schema=[
            SlotFieldSchema(
                name="category",
                description="Категорія проблеми",
                enum_values=["pothole", "garbage"],
            ),
            SlotFieldSchema(name="address", description="Адреса проблеми"),
        ],
        current_slots={"category": "pothole"},
    )
    assert "category" in prompt
    assert "address" in prompt
    assert "pothole" in prompt  # already-filled slot surfaced back to the model
    assert "wants_cancel" in prompt
    assert "is_unrelated" in prompt


def test_slot_extraction_prompt_forbids_copying_trigger_phrase_as_description() -> None:
    """Regression: a message that only mentions an action's topic/intent (e.g. "створити
    звернення про Х") is a command to start the flow, not a description of the situation, and
    must never be copied into a free-text field. Before this instruction was added, live
    reproduction against the running service showed the model doing exactly that — extracting
    description: "Створити звернення про яму" from the triggering message itself, i.e. treating
    "mentions the general topic" as sufficient content for a free-text field."""
    from app.schemas.actions import SlotFieldSchema

    prompt = build_slot_extraction_prompt(
        message="будь-яке повідомлення",
        slot_schema=[SlotFieldSchema(name="description", description="Опис ситуації")],
        current_slots={},
    )
    assert "НЕ Є описом ситуації" in prompt
    assert "команда почати процес" in prompt


def test_slot_extraction_prompt_repro_bug_trigger_only_message() -> None:
    """Locks in the exact live-reproduction conditions for the bug above: the first turn of the
    "create an appeal" flow, where `message` IS the triggering command sentence and no slots are
    filled yet (current_slots={}). build_slot_extraction_prompt is a pure string-building function
    (no I/O — see the module's layer contract), so this can't assert on actual LLM behaviour; it
    instead proves the built prompt (a) carries the trigger message verbatim inside <text>,
    matching the exact conditions that reproduced the bug, with the real appeal fields (category/
    description/address, mirroring backend_app's appeal schema) in scope, and (b) contains the
    anti-parroting instruction that stops the model from treating "mentions the topic" as
    sufficient content for `description`. This is a test that would fail if that instruction were
    ever deleted — not an attempt to mock the model's own judgment."""
    from app.schemas.actions import SlotFieldSchema

    message = "Створити звернення про яму"
    appeal_slot_schema = [
        SlotFieldSchema(
            name="category",
            description="Категорія проблеми",
            enum_values=["pothole", "garbage", "lighting"],
        ),
        SlotFieldSchema(name="description", description="Опис ситуації"),
        SlotFieldSchema(name="address", description="Адреса проблеми"),
    ]

    prompt = build_slot_extraction_prompt(
        message=message, slot_schema=appeal_slot_schema, current_slots={}
    )

    assert f"<text>\n{message}\n</text>" in prompt
    assert "description" in prompt  # the exact field the bug polluted must be in scope here
    assert "НЕ Є описом ситуації" in prompt
    assert "команда почати процес" in prompt
