"""
Purpose:   Offline evaluation harness (the 8->10 quality gate). Runs two gold sets against the
           live service: retrieval hit-rate@k (datasets/retrieval_gold.jsonl) and classifier
           routing accuracy (datasets/routing_gold.jsonl); optional LLM-as-judge groundedness
           behind a flag. Pure-Python metrics — no RAGAS/heavy dep. Prints a scorecard and exits
           non-zero when a metric falls below its floor, so CI fails on retrieval/routing
           regression. Run: `python -m eval.run_eval` (or a @slow CI job).
           DEVIATION from "read-only against the KB": this harness self-seeds a small, fixed set of
           `eval_fixture_*`-namespaced documents (datasets/retrieval_fixtures.jsonl) through the
           real IngestService, scores retrieval against THOSE rows only, then deletes them in a
           `finally` block — it never reads or judges whatever real content already lives in
           knowledge_base. That trade is deliberate: hit-rate against the live demo KB would drift
           with whatever got scraped that day, which is exactly the flakiness a CI quality gate
           must not have. The harness owns only its own `eval_fixture_*` rows; everything else in
           the table is untouched.
Layer:     script  (composition root for an offline job — may wire concrete components, like main.py
           and scripts/calibrate_thresholds.py)
May import:   app.config, app.components/* (embedder, repository, hybrid_retriever, llm),
              app.domain/* (classifier, districts, prompts), app.protocols, app.schemas/* (ingest,
              common), app.services.ingest_service, asyncpg, pgvector, stdlib (argparse, json)
Must NOT import:  api/*; tests/*. Owns only its own `eval_fixture_*` rows in knowledge_base — see
              the DEVIATION note above for why that's no longer strictly read-only.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

import asyncpg
from pgvector.asyncpg import register_vector

from app.components.embedder import Embedder as OpenAIEmbedder
from app.components.hybrid_retriever import HybridRetriever
from app.components.llm import OpenAILLMClient
from app.components.repository import KnowledgeRepository
from app.config import Settings
from app.domain.classifier import classify_query
from app.domain.districts import canonicalize_district
from app.domain.prompts import build_rag_prompt
from app.protocols import Embedder, Generator, Retriever
from app.schemas.common import DocType
from app.schemas.ingest import IngestRequest
from app.services.ingest_service import IngestService

_DATASETS_DIR = Path(__file__).parent / "datasets"
_ROUTING_GOLD_PATH = _DATASETS_DIR / "routing_gold.jsonl"
_RETRIEVAL_GOLD_PATH = _DATASETS_DIR / "retrieval_gold.jsonl"
_RETRIEVAL_FIXTURES_PATH = _DATASETS_DIR / "retrieval_fixtures.jsonl"

_DEFAULT_K = 3
_DEFAULT_HITRATE_FLOOR = 0.90
_DEFAULT_ROUTING_FLOOR = 0.95

_JUDGE_PROMPT_TEMPLATE = (
    "Контекст:\n{context}\n\n"
    "Питання: {question}\n"
    "Відповідь: {answer}\n\n"
    "Чи відповідь повністю базується на наведеному контексті, без вигаданих фактів? "
    "Відповідай ТІЛЬКИ одним словом: YES або NO."
)


def _read_jsonl(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


async def seed_fixtures(ingest_service: IngestService, fixtures_path: Path) -> list[str]:
    """Ingest every fixture in fixtures_path, return the list of document_ids seeded (for cleanup)."""
    document_ids: list[str] = []
    for row in _read_jsonl(fixtures_path):
        request = IngestRequest(
            document_id=row["document_id"],
            text=row["text"],
            doc_type=DocType(row["doc_type"]),
            source=row["source"],
            district=row.get("district"),
            ttl_days=row.get("ttl_days"),
        )
        await ingest_service.ingest(request)
        document_ids.append(row["document_id"])
    return document_ids


async def cleanup_fixtures(pool: asyncpg.Pool, document_ids: list[str]) -> None:
    """Delete the seeded fixture rows so repeated runs against a real/shared DB don't accumulate
    permanent test debris. Always call this in a finally block around the evaluation."""
    if not document_ids:
        return
    await pool.execute(
        "DELETE FROM knowledge_base WHERE document_id = ANY($1::text[])", document_ids
    )


def compute_routing_accuracy(gold_path: Path = _ROUTING_GOLD_PATH) -> tuple[int, int]:
    """Pure — no DB, no embedder. Returns (correct, total)."""
    rows = _read_jsonl(gold_path)
    correct = sum(1 for row in rows if classify_query(row["query"]).value == row["expected_route"])
    return correct, len(rows)


async def compute_retrieval_hitrate(
    retriever: Retriever,
    embedder: Embedder,
    gold_path: Path = _RETRIEVAL_GOLD_PATH,
    k: int = _DEFAULT_K,
) -> tuple[int, int]:
    """For each gold row: embed the query, canonicalize `district` exactly like the real query path
    does in rag_service.py (the gold file stores a recognized surface form of the slug, not the
    slug itself — see eval/datasets/retrieval_gold.jsonl), retrieve via the injected Retriever, and
    check whether gold_source appears among the fused top-k results' .source field. Returns
    (hits, total). HybridRetriever.retrieve()'s fused list may be longer than k (it's the deduped
    union of both legs), so top-k is sliced here rather than trusted from the return value."""
    rows = _read_jsonl(gold_path)
    hits = 0
    for row in rows:
        query_vec = await embedder.encode_query(row["query"])
        district_slug = canonicalize_district(row.get("district"))
        outcome = await retriever.retrieve(row["query"], query_vec, district_slug, k)
        sources = {result.source for result in outcome.fused[:k]}
        if row["gold_source"] in sources:
            hits += 1
    return hits, len(rows)


async def _judge_one_row(
    retriever: Retriever, embedder: Embedder, generator: Generator, row: dict, k: int
) -> bool | None:
    """Retrieve + generate + judge a single gold row. None when retrieval returned no context to
    judge against (rather than a False, which would mean "judged and NOT grounded")."""
    query_vec = await embedder.encode_query(row["query"])
    district_slug = canonicalize_district(row.get("district"))
    outcome = await retriever.retrieve(row["query"], query_vec, district_slug, k)
    context_chunks = [result.text for result in outcome.fused[:k]]
    if not context_chunks:
        return None

    answer, _ = await generator.generate(
        build_rag_prompt(context_chunks, row["query"]),
        temperature=0.0, max_tokens=512, timeout_s=15.0,
    )
    verdict, _ = await generator.generate(
        _JUDGE_PROMPT_TEMPLATE.format(
            context="\n\n".join(context_chunks), question=row["query"], answer=answer
        ),
        temperature=0.0, max_tokens=5, timeout_s=15.0,
    )
    return verdict.strip().upper().startswith("YES")


async def run_judge(
    retriever: Retriever,
    embedder: Embedder,
    generator: Generator,
    gold_path: Path = _RETRIEVAL_GOLD_PATH,
    k: int = _DEFAULT_K,
) -> float:
    """OPTIONAL, informational-only groundedness check — never affects the exit code. For each
    retrieval_gold query: retrieve real context, generate a real answer with the same prompt
    production uses (build_rag_prompt), then ask the same Generator whether its own answer is
    grounded in that context. Two extra Generator calls per gold row — a minimal LLM-as-judge, not
    a RAGAS-style pipeline, proportionate to a flag that's off by default and never gates CI.
    Returns the grounded fraction, or 0.0 if the gold set is empty or no query returned context."""
    verdicts = [
        await _judge_one_row(retriever, embedder, generator, row, k)
        for row in _read_jsonl(gold_path)
    ]
    judged = [verdict for verdict in verdicts if verdict is not None]
    return sum(judged) / len(judged) if judged else 0.0


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Offline eval gate: retrieval hit-rate + classifier routing accuracy."
    )
    parser.add_argument(
        "--db", default=os.environ.get("DATABASE_URL"), help="Postgres DSN (default: $DATABASE_URL)."
    )
    parser.add_argument(
        "--api-key",
        default=os.environ.get("OPENAI_API_KEY"),
        help="OpenAI API key (default: $OPENAI_API_KEY).",
    )
    parser.add_argument(
        "--embed-model",
        default=os.environ.get("EMBED_MODEL"),
        help="OpenAI embedding model (default: $EMBED_MODEL).",
    )
    parser.add_argument(
        "--llm-model",
        default=os.environ.get("LLM_MODEL"),
        help="OpenAI chat model — only needed with --judge (default: $LLM_MODEL).",
    )
    parser.add_argument(
        "--rrf-k",
        type=int,
        default=int(os.environ.get("RRF_K", 60)),
        help="RRF smoothing constant (default: $RRF_K or 60).",
    )
    parser.add_argument("--k", type=int, default=_DEFAULT_K, help="hit-rate@k (default: 3).")
    parser.add_argument(
        "--hitrate-floor",
        type=float,
        default=_DEFAULT_HITRATE_FLOOR,
        help=f"Minimum retrieval hit-rate to pass (default: {_DEFAULT_HITRATE_FLOOR}).",
    )
    parser.add_argument(
        "--routing-floor",
        type=float,
        default=_DEFAULT_ROUTING_FLOOR,
        help=f"Minimum routing accuracy to pass (default: {_DEFAULT_ROUTING_FLOOR}).",
    )
    parser.add_argument(
        "--judge",
        action="store_true",
        help="Also run the informational LLM-as-judge groundedness check (never gates the exit code).",
    )
    return parser.parse_args()


async def _create_pool(db_url: str) -> asyncpg.Pool:
    """Pool with the pgvector codec registered, so numpy vectors marshal on both read and write."""

    async def init(conn: asyncpg.Connection) -> None:
        await register_vector(conn)

    return await asyncpg.create_pool(db_url, min_size=1, max_size=5, init=init)


def _print_scorecard(
    routing: tuple[int, int],
    hitrate: tuple[int, int],
    routing_floor: float,
    hitrate_floor: float,
    judge_score: float | None,
) -> bool:
    routing_correct, routing_total = routing
    hits, hitrate_total = hitrate
    routing_pct = routing_correct / routing_total if routing_total else 0.0
    hitrate_pct = hits / hitrate_total if hitrate_total else 0.0
    routing_pass = routing_pct >= routing_floor
    hitrate_pass = hitrate_pct >= hitrate_floor

    print("\n=== Offline eval scorecard ===")
    print(
        f"Routing accuracy:   {routing_correct}/{routing_total} = {routing_pct:.1%}"
        f"  (floor {routing_floor:.0%})  {'PASS' if routing_pass else 'FAIL'}"
    )
    print(
        f"Retrieval hit-rate: {hits}/{hitrate_total} = {hitrate_pct:.1%}"
        f"  (floor {hitrate_floor:.0%})  {'PASS' if hitrate_pass else 'FAIL'}"
    )
    if judge_score is not None:
        print(f"Groundedness (judge, informational only): {judge_score:.1%}")
    print("===============================\n")
    return routing_pass and hitrate_pass


async def _run(args: argparse.Namespace) -> bool:
    embedder = OpenAIEmbedder(api_key=args.api_key, model=args.embed_model)
    pool = await _create_pool(args.db)
    document_ids: list[str] = []
    try:
        repo = KnowledgeRepository(pool)
        retriever = HybridRetriever(repo, args.rrf_k)
        # internal_token is unused by IngestService — it's required by Settings' schema, not by
        # anything this script does, so a filler value avoids depending on an unrelated env var.
        settings = Settings(database_url=args.db, openai_api_key=args.api_key, internal_token="unused")
        ingest_service = IngestService(repo, embedder, settings)

        document_ids = await seed_fixtures(ingest_service, _RETRIEVAL_FIXTURES_PATH)

        routing = compute_routing_accuracy(_ROUTING_GOLD_PATH)
        hitrate = await compute_retrieval_hitrate(
            retriever, embedder, _RETRIEVAL_GOLD_PATH, k=args.k
        )

        judge_score = None
        if args.judge:
            generator = OpenAILLMClient(api_key=args.api_key, model=args.llm_model)
            judge_score = await run_judge(
                retriever, embedder, generator, _RETRIEVAL_GOLD_PATH, k=args.k
            )
    finally:
        await cleanup_fixtures(pool, document_ids)
        await pool.close()

    return _print_scorecard(routing, hitrate, args.routing_floor, args.hitrate_floor, judge_score)


def main() -> int:
    args = _parse_args()
    if not args.db:
        print("ERROR: no database URL — pass --db or set DATABASE_URL.", file=sys.stderr)
        return 2
    if not args.api_key:
        print("ERROR: no OpenAI API key — pass --api-key or set OPENAI_API_KEY.", file=sys.stderr)
        return 2
    if not args.embed_model:
        print("ERROR: no embedding model — pass --embed-model or set EMBED_MODEL.", file=sys.stderr)
        return 2
    if args.judge and not args.llm_model:
        print("ERROR: --judge requires a chat model — pass --llm-model or set LLM_MODEL.", file=sys.stderr)
        return 2

    passed = asyncio.run(_run(args))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
