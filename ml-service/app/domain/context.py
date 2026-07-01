"""
Purpose:   assemble_context(chunks, token_budget, count_tokens_fn) -> list[RetrievalResult]. PURE:
           dedup by chunk id (first occurrence wins, input is already rank-ordered by the caller —
           e.g. RRF-fused order), preserve that order, and greedily keep chunks while the running
           token count stays within token_budget — but always keep at least the first (highest-
           ranked) chunk, even if it alone exceeds the budget, since by the time this runs the
           confidence gate has already judged the retrieval relevant; an empty context would throw
           that away. Deliberately returns the RetrievalResult objects themselves, NOT a joined
           string: prompts.build_rag_prompt() already owns all LLM-visible formatting (the
           <context>/<question> XML delimiting that is the tested anti-injection framing), so a
           second layer of per-chunk source markers here would duplicate that concern and risk
           drifting out of sync with it. Returning the same list lets callers derive both the prompt
           text ([r.text for r in kept]) and the sources_used entries from one list, so they can
           never disagree about which chunks were actually shown to the model.
Layer:     domain
May import:   stdlib, schemas/retrieval (RetrievalResult)
Must NOT import:  api/*, services/*, components/*, pipeline/*; any I/O or model lib (asyncpg,
              google-genai, sentence-transformers, FastAPI). Token counting uses an injected
              callable to stay pure.
"""
from __future__ import annotations

from collections.abc import Callable

from app.schemas.retrieval import RetrievalResult

# Tunable later. Sized to comfortably hold several ~300-400 token chunks from the chunker plus the
# fixed prompt/system-instruction overhead, well within gpt-4o-mini's context window.
CONTEXT_TOKEN_BUDGET = 1200


def assemble_context(
    chunks: list[RetrievalResult],
    token_budget: int,
    count_tokens_fn: Callable[[str], int],
) -> list[RetrievalResult]:
    """
    Dedup `chunks` by `.id` (first occurrence wins), then greedily keep chunks in order while their
    combined token count (via `count_tokens_fn` over each `.text`) stays within `token_budget`.

    The first chunk is always kept, even if it alone exceeds the budget — the caller has already
    passed the confidence gate on this retrieval, so returning nothing would be wrong.
    """
    deduped: list[RetrievalResult] = []
    seen_ids: set[int] = set()
    for chunk in chunks:
        if chunk.id in seen_ids:
            continue
        seen_ids.add(chunk.id)
        deduped.append(chunk)

    if not deduped:
        return []

    kept = [deduped[0]]
    total_tokens = count_tokens_fn(deduped[0].text)
    for chunk in deduped[1:]:
        total_tokens += count_tokens_fn(chunk.text)
        if total_tokens > token_budget:
            break
        kept.append(chunk)

    return kept
