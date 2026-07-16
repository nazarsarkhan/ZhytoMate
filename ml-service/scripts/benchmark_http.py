"""Measure live RAG latency and response-status distribution.

Example:
    python scripts/benchmark_http.py --url http://localhost:8000 --token TOKEN \
        --queries eval/datasets/queries_benchmark.jsonl --concurrency 4
"""
from __future__ import annotations

import argparse
import asyncio
import json
import statistics
import time
from pathlib import Path

import httpx


def _read_queries(path: Path) -> list[str]:
    queries: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        value = json.loads(line)
        queries.append(value["query"] if isinstance(value, dict) else str(value))
    return queries


def _percentile(values: list[float], percentile: float) -> float:
    ordered = sorted(values)
    if not ordered:
        return 0.0
    index = min(len(ordered) - 1, round((len(ordered) - 1) * percentile))
    return ordered[index]


async def _run(args: argparse.Namespace) -> int:
    queries = _read_queries(Path(args.queries))
    if not queries:
        raise SystemExit("benchmark query file is empty")

    semaphore = asyncio.Semaphore(args.concurrency)
    headers = {"X-Internal-Token": args.token}
    latencies: list[float] = []
    statuses: dict[str, int] = {}
    failures = 0

    async with httpx.AsyncClient(base_url=args.url.rstrip("/"), timeout=args.timeout) as client:
        async def request(index: int, query: str) -> None:
            nonlocal failures
            async with semaphore:
                started = time.perf_counter()
                try:
                    response = await client.post(
                        "/api/v1/chat/query",
                        headers=headers,
                        json={"user_query": query, "user_id": f"benchmark-{index}"},
                    )
                    latencies.append((time.perf_counter() - started) * 1000)
                    if response.is_success:
                        status = response.json().get("answer_status", "missing")
                        statuses[status] = statuses.get(status, 0) + 1
                    else:
                        failures += 1
                except Exception:
                    failures += 1

        await asyncio.gather(*(request(index, query) for index, query in enumerate(queries)))

    print(f"requests={len(queries)} failures={failures}")
    print(
        "latency_ms: "
        f"p50={_percentile(latencies, 0.50):.1f} "
        f"p95={_percentile(latencies, 0.95):.1f} "
        f"p99={_percentile(latencies, 0.99):.1f} "
        f"mean={statistics.mean(latencies):.1f}"
    )
    print(f"answer_status={json.dumps(statuses, ensure_ascii=False, sort_keys=True)}")
    return 1 if failures else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Benchmark the live ZhytoMate RAG HTTP endpoint.")
    parser.add_argument("--url", default="http://localhost:8000")
    parser.add_argument("--token", required=True)
    parser.add_argument("--queries", required=True)
    parser.add_argument("--concurrency", type=int, default=4)
    parser.add_argument("--timeout", type=float, default=30.0)
    return asyncio.run(_run(parser.parse_args()))


if __name__ == "__main__":
    raise SystemExit(main())
