"""Concurrent RAG smoke test with cache/stampede visibility.

Example:
    python scripts/load_test_http.py --token TOKEN --concurrency 20 --rounds 2
"""
from __future__ import annotations

import argparse
import asyncio
import statistics
import time

import httpx


def percentile(values: list[float], ratio: float) -> float:
    ordered = sorted(values)
    if not ordered:
        return 0.0
    return ordered[min(len(ordered) - 1, round((len(ordered) - 1) * ratio))]


def metric_value(text: str, metric: str) -> float:
    prefix = f"{metric} "
    for line in text.splitlines():
        if line.startswith(prefix):
            try:
                return float(line.rsplit(" ", 1)[-1])
            except ValueError:
                return 0.0
    return 0.0


async def main_async(args: argparse.Namespace) -> int:
    limits = httpx.Limits(
        max_connections=args.concurrency,
        max_keepalive_connections=args.concurrency,
        keepalive_expiry=30.0,
    )
    timeout = httpx.Timeout(args.timeout, connect=5.0)
    query = "Хто мер Житомира?"
    async with httpx.AsyncClient(
        base_url=args.url.rstrip("/"), headers={"X-Internal-Token": args.token},
        limits=limits, timeout=timeout,
    ) as client:
        before = await client.get("/metrics")
        hits_before = metric_value(before.text, "zhytomate_classification_cache_hits_total")
        all_latencies: list[float] = []
        failures = 0
        for round_index in range(args.rounds):
            semaphore = asyncio.Semaphore(args.concurrency)

            async def one(index: int) -> float | None:
                nonlocal failures
                async with semaphore:
                    started = time.perf_counter()
                    try:
                        response = await client.post(
                            "/api/v1/chat/query",
                            json={"user_query": query, "user_id": f"load-{round_index}-{index}"},
                        )
                        if not response.is_success:
                            failures += 1
                            return None
                        return (time.perf_counter() - started) * 1000
                    except Exception:
                        failures += 1
                        return None

            results = await asyncio.gather(*(one(index) for index in range(args.concurrency)))
            latencies = [value for value in results if value is not None]
            all_latencies.extend(latencies)
            print(
                f"round={round_index + 1} requests={len(latencies)} failures={args.concurrency - len(latencies)} "
                f"p50={percentile(latencies, .50):.1f}ms p95={percentile(latencies, .95):.1f}ms"
            )
        after = await client.get("/metrics")
        hits_after = metric_value(after.text, "zhytomate_classification_cache_hits_total")

    print(
        f"total={len(all_latencies)} failures={failures} "
        f"p50={percentile(all_latencies, .50):.1f}ms "
        f"p95={percentile(all_latencies, .95):.1f}ms "
        f"p99={percentile(all_latencies, .99):.1f}ms "
        f"mean={statistics.mean(all_latencies):.1f}ms "
        f"classification_cache_hits_delta={hits_after - hits_before:.0f}"
    )
    return 1 if failures else 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://localhost:8000")
    parser.add_argument("--token", required=True)
    parser.add_argument("--concurrency", type=int, default=20)
    parser.add_argument("--rounds", type=int, default=2)
    parser.add_argument("--timeout", type=float, default=45.0)
    return asyncio.run(main_async(parser.parse_args()))


if __name__ == "__main__":
    raise SystemExit(main())
