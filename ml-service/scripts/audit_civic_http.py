"""Run a deterministic smoke matrix for common Zhytomyr resident questions."""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from dataclasses import dataclass

import httpx


@dataclass(frozen=True)
class CivicCase:
    question: str
    topic: str


CASES = (
    CivicCase("Де знаходиться ЦНАП у Житомирі?", "cnap-address"),
    CivicCase("Який графік роботи ЦНАП?", "cnap-hours"),
    CivicCase("Які телефони ЦНАП?", "cnap-phone"),
    CivicCase("Де знаходиться міська рада і який її телефон?", "city-council"),
    CivicCase("Як подати звернення громадянина?", "appeals"),
    CivicCase("Де знайти зразки заяв та інформаційних запитів?", "appeal-templates"),
    CivicCase("Де оформити адміністративні послуги?", "admin-services"),
    CivicCase("Де отримати соціальні послуги?", "social-services"),
    CivicCase("Куди звертатися ветерану у Житомирі?", "veterans"),
    CivicCase("Де знайти карту укриттів?", "shelters"),
    CivicCase("Де подивитися карту безбар’єрності?", "accessibility"),
    CivicCase("Як зареєструвати дитину в садок або школу?", "education-registration"),
    CivicCase("Куди звертатися з питанням водопостачання?", "water"),
    CivicCase("Хто відповідає за житлово-комунальні питання?", "utilities"),
    CivicCase("Де знайти інформацію про квартирний облік?", "housing-registration"),
    CivicCase("Де інформація про комунальне майно і землю?", "property-land"),
    CivicCase("Як знайти потрібний департамент або посадовця міськради?", "officials"),
    CivicCase("Де подивитися маршрути громадського транспорту?", "transport"),
    CivicCase("Куди повідомити про яму або проблему благоустрою?", "public-works"),
    CivicCase("Де знайти інформацію про тарифи?", "tariffs"),
)


async def run(base_url: str, token: str, timeout: float) -> list[dict[str, object]]:
    headers = {"X-Internal-Token": token}
    results: list[dict[str, object]] = []
    async with httpx.AsyncClient(base_url=base_url.rstrip("/"), timeout=timeout) as client:
        for index, case in enumerate(CASES, start=1):
            try:
                response = await client.post(
                    "/api/v1/chat/query",
                    headers=headers,
                    json={"user_query": case.question, "user_id": f"civic-audit-{index}"},
                )
                body = response.json()
                results.append(
                    {
                        "index": index,
                        "topic": case.topic,
                        "question": case.question,
                        "http_status": response.status_code,
                        "answer_status": body.get("answer_status"),
                        "grounded": body.get("grounded") is True,
                        "verified": body.get("verified") is True,
                        "confidence": body.get("confidence"),
                        "sources": [
                            source.get("source")
                            for source in body.get("sources_used", [])
                        ],
                        "answer": body.get("answer", ""),
                    }
                )
            except (httpx.HTTPError, json.JSONDecodeError) as error:
                results.append(
                    {
                        "index": index,
                        "topic": case.topic,
                        "question": case.question,
                        "http_status": None,
                        "error": f"{type(error).__name__}: {error}",
                    }
                )
    return results


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default=os.getenv("RAG_URL", "http://localhost:8000"))
    parser.add_argument("--token", default=os.getenv("INTERNAL_TOKEN"))
    parser.add_argument("--timeout", type=float, default=60.0)
    parser.add_argument("--json", action="store_true", dest="as_json")
    args = parser.parse_args()
    if not args.token:
        parser.error("--token or INTERNAL_TOKEN is required")

    results = asyncio.run(run(args.url, args.token, args.timeout))
    if args.as_json:
        print(json.dumps(results, ensure_ascii=False, indent=2))
    else:
        grounded = 0
        verified = 0
        for result in results:
            is_grounded = result.get("grounded") is True
            is_verified = result.get("verified") is True
            grounded += is_grounded
            verified += is_verified
            status = "OK" if is_grounded and is_verified else "MISS"
            print(
                f"{status:4} {result['index']:02} {result['topic']:<22} "
                f"confidence={result.get('confidence', 0)!s:<4} "
                f"sources={len(result.get('sources', []))} | {result['question']}"
            )
        print(f"Summary: grounded={grounded}/{len(results)} verified={verified}/{len(results)}")
    return 0 if all(result.get("http_status") == 200 for result in results) else 1


if __name__ == "__main__":
    sys.exit(main())
