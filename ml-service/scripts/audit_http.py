"""Run the live RAG regression matrix and print one row per query.

The audit intentionally checks API invariants rather than judging generated prose:
ungrounded answers must never expose retrieval sources, and verified answers must be grounded.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from pathlib import Path

import httpx


def read_cases(path: Path) -> list[dict[str, str]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


async def run(args: argparse.Namespace) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    cases = read_cases(Path(args.queries))[args.offset : args.offset + args.limit if args.limit else None]
    headers = {"X-Internal-Token": args.token}
    semaphore = asyncio.Semaphore(max(1, args.concurrency))

    async def audit_one(client: httpx.AsyncClient, index: int, case: dict[str, str]) -> tuple[int, str, bool]:
        async with semaphore:
            started = time.perf_counter()
            try:
                response = await client.post(
                    "/api/v1/chat/query",
                    headers=headers,
                    json={"user_query": case["query"], "user_id": f"audit-{index}"},
                )
            except httpx.HTTPError as error:
                elapsed = (time.perf_counter() - started) * 1000
                return index, f"FAIL | {elapsed:7.0f}ms | {case['kind']:<10} | {type(error).__name__} | {case['query']}", True
            elapsed = (time.perf_counter() - started) * 1000
            if not response.is_success:
                return index, f"FAIL | {elapsed:7.0f}ms | {case['kind']:<10} | HTTP {response.status_code} | {case['query']}", True
            body = response.json()
            sources = body.get("sources_used") or []
            grounded = body.get("grounded") is True
            verified = body.get("verified") is True
            invariant_ok = (grounded or not sources) and (not verified or grounded)
            status = "OK" if invariant_ok else "FAIL"
            line = (
                f"{status} | {elapsed:7.0f}ms | {case['kind']:<10} | "
                f"{body.get('answer_status', '?'):<18} | grounded={grounded} verified={verified} "
                f"sources={len(sources)} | {case['query']}"
            )
            return index, line, not invariant_ok

    async with httpx.AsyncClient(base_url=args.url.rstrip("/"), timeout=args.timeout) as client:
        results = await asyncio.gather(*(audit_one(client, index, case) for index, case in enumerate(cases)))
    failures = sum(failed for _, _, failed in sorted(results))
    for _, line, _ in sorted(results):
        print(line)
    return 1 if failures else 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://localhost:8000")
    parser.add_argument("--token", required=True)
    parser.add_argument("--queries", required=True)
    parser.add_argument("--timeout", type=float, default=45.0)
    # Keep the default conservative: the ML service has a per-user rate limit and the LLM
    # provider may serialize requests. Operators can raise this explicitly for a larger pool.
    parser.add_argument("--concurrency", type=int, default=1)
    parser.add_argument("--offset", type=int, default=0)
    parser.add_argument("--limit", type=int, default=0)
    return asyncio.run(run(parser.parse_args()))


if __name__ == "__main__":
    raise SystemExit(main())
