"""
Purpose:   Offline tool (NOT served): calibrate SIM_GATE / SIM_HIGH on the seeded KB. Loads labelled
           known-relevant + known-irrelevant query sets, embeds + runs DENSE retrieval against the
           live pool, records top-1 cosine similarity for each, prints the two distributions and the
           separation point, and emits suggested SIM_GATE (just above the irrelevant cluster) /
           SIM_HIGH (confident band). Turns SYSTEM_DESIGN §2.7's caveat into a runnable, pre-demo
           closed loop. Read-only — never writes to knowledge_base.
           Run manually:  python scripts/calibrate_thresholds.py [--db DSN] [--api-key KEY] [--model NAME]
Layer:     script  (composition root for an offline job — may wire concrete components, like main.py)
May import:   app.config, app.components/* (embedder, repository), app.domain/*, asyncpg, pgvector, stdlib
Must NOT import:  api/*; tests/*. Never writes to the DB (read-only calibration).
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

from app.components.embedder import Embedder
from app.components.repository import KnowledgeRepository

_DATA_PATH = Path(__file__).parent / "calibration_data.json"

# Shipped alongside this script in calibration_data.json; regenerated here only if that file
# is deleted (so a fresh checkout always has something runnable).
_DEFAULT_DATA: dict[str, list[str]] = {
    "relevant": [
        "Коли дадуть воду в Богунському районі?",
        "Графік вивезення сміття у Житомирі",
        "Де знаходиться ЦНАП у Житомирі?",
        "Відключення електроенергії Житомир сьогодні",
        "Маршрути автобусів у Житомирі",
    ],
    "irrelevant": [
        "Яка погода в Парижі завтра?",
        "Розклад поїздів Київ-Львів",
        "Курс долара сьогодні",
        "Рецепт борщу",
        "Новини футболу в Іспанії",
    ],
}


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Calibrate SIM_GATE / SIM_HIGH on the seeded KB (read-only, §2.7)."
    )
    parser.add_argument(
        "--db",
        default=os.environ.get("DATABASE_URL"),
        help="Postgres DSN (default: $DATABASE_URL).",
    )
    parser.add_argument(
        "--api-key",
        default=os.environ.get("OPENAI_API_KEY"),
        help="OpenAI API key (default: $OPENAI_API_KEY).",
    )
    parser.add_argument(
        "--model",
        default=os.environ.get("EMBED_MODEL"),
        help="OpenAI embedding model (default: $EMBED_MODEL).",
    )
    return parser.parse_args()


async def _create_pool(db_url: str) -> asyncpg.Pool:
    """Read-only asyncpg pool with the pgvector codec registered, so numpy vectors marshal."""

    async def init(conn: asyncpg.Connection) -> None:
        await register_vector(conn)

    return await asyncpg.create_pool(db_url, min_size=1, max_size=2, init=init)


async def _top1_similarity(embedder: Embedder, repo: KnowledgeRepository, query: str) -> float:
    """Dense top-1 cosine for one query (0.0 when the KB returns nothing)."""
    vec = await embedder.encode_query(query)
    results = await repo.retrieve_dense(vec, None, limit=1)
    return results[0].similarity if results else 0.0


def _print_distribution(title: str, measured: list[tuple[str, float]]) -> None:
    print(f"\n{title}")
    for query, similarity in measured:
        print(f"  {query[:60]:<60s} →  {similarity:.2f}")


def _report_separation(relevant: list[float], irrelevant: list[float]) -> None:
    """Print the separation verdict, then env-ready SIM_GATE / SIM_HIGH (always emitted)."""
    relevant_min = min(relevant)
    irrelevant_max = max(irrelevant)
    suggested_gate = round((relevant_min + irrelevant_max) / 2, 2)
    suggested_high = round(relevant_min - 0.01, 2)

    if relevant_min > irrelevant_max:
        print("\n✅ Clean separation found.")
        print(f"   Suggested SIM_GATE={suggested_gate}  SIM_HIGH={suggested_high}")
        print("   Set these in your .env and restart the service.")
    else:
        print("\n⚠️  Distributions OVERLAP. Clusters are not separable at this threshold.")
        print(f"   relevant_min={relevant_min:.3f}  irrelevant_max={irrelevant_max:.3f}")
        print("   Possible causes: KB too thin, wrong e5 prefixes, chunking too coarse.")
        print("   Fix the root cause; do not just lower SIM_GATE.")

    print("\n# Env-ready suggested values:")
    print(f"SIM_GATE={suggested_gate}")
    print(f"SIM_HIGH={suggested_high}")


async def _run(db_url: str, api_key: str, model: str, query_sets: dict[str, list[str]]) -> None:
    print("Loading OpenAI embedder …")
    embedder = Embedder(api_key=api_key, model=model)
    print("Connecting to the database (read-only) …")
    pool = await _create_pool(db_url)
    try:
        repo = KnowledgeRepository(pool)
        relevant = [(q, await _top1_similarity(embedder, repo, q)) for q in query_sets["relevant"]]
        irrelevant = [
            (q, await _top1_similarity(embedder, repo, q)) for q in query_sets["irrelevant"]
        ]
    finally:
        await pool.close()

    _print_distribution("RELEVANT queries (top-1 similarity):", relevant)
    _print_distribution("IRRELEVANT queries (top-1 similarity):", irrelevant)
    _report_separation([sim for _, sim in relevant], [sim for _, sim in irrelevant])


def main() -> int:
    args = _parse_args()
    if not args.db:
        print("ERROR: no database URL — pass --db or set DATABASE_URL.", file=sys.stderr)
        return 2
    if not args.api_key:
        print("ERROR: no OpenAI API key — pass --api-key or set OPENAI_API_KEY.", file=sys.stderr)
        return 2
    if not args.model:
        print("ERROR: no embedding model — pass --model or set EMBED_MODEL.", file=sys.stderr)
        return 2

    if not _DATA_PATH.exists():
        _DATA_PATH.write_text(
            json.dumps(_DEFAULT_DATA, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"Created default {_DATA_PATH}. Review/edit it for your KB, then re-run.")
        return 0

    query_sets = json.loads(_DATA_PATH.read_text(encoding="utf-8"))
    if not query_sets.get("relevant") or not query_sets.get("irrelevant"):
        print(
            f"ERROR: {_DATA_PATH.name} needs non-empty 'relevant' and 'irrelevant' lists.",
            file=sys.stderr,
        )
        return 2

    asyncio.run(_run(args.db, args.api_key, args.model, query_sets))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
