"""
Purpose:   Offline tool (NOT served): re-ingest a small set of manually-curated, static civic facts
           (CNAP address/hours/contacts, emergency phone numbers) that the parser's web/Telegram
           crawl does not reliably capture as clean, directly-answerable content — the source pages
           exist (e.g. zt-rada.gov.ua's own CNAP department page) but the parser only ever sees them
           buried in unrelated report/statistics documents, if at all. Idempotent: POSTs to the
           already-running ml-service's own ingest endpoint (doc_type="instruction", so no ttl_days,
           no expiry) using document_id values stable across runs, so ingest_service's existing
           content-hash dedup makes a re-run a safe no-op unless the text actually changed. Exists
           specifically so a full KB reseed (TRUNCATE knowledge_base + re-run the parser, per the
           root CLAUDE.md's Demo Runbook) does not silently lose this content — run this script once
           after any such reseed.
           Run manually (ml-service must already be up):
             python scripts/seed_manual_facts.py [--base-url URL] [--token TOKEN]
Layer:     script  (composition root for an offline job - may wire concrete components, like main.py)
May import:   stdlib only (urllib, no app.* — this only ever talks to the already-running HTTP API,
              never touches the DB or embedder directly, so ingestion behavior can never drift from
              what a real POST /api/v1/knowledge/ingest call does for any other caller)
Must NOT import:  api/*, app.*; tests/*. Never writes to the DB directly — always via the HTTP API.
"""
from __future__ import annotations

import argparse
import json
import os
import urllib.error
import urllib.request

_CNAP_TEXT = (
    "Центр надання адміністративних послуг (ЦНАП) Житомирської міської ради розташований "
    "за адресою: м. Житомир, вул. Михайлівська, 4.\n\n"
    "Графік роботи ЦНАП: понеділок - п'ятниця, з 8:30 до 17:30, обідня перерва з 12:30 до 13:30.\n\n"
    "Контактні телефони ЦНАП: (0412) 47-06-15, (0412) 47-46-69, (0412) 47-46-68.\n\n"
    "Електронна пошта ЦНАП: admincentr@ztrada.gov.ua.\n\n"
    "Попередній запис на прийом до ЦНАП можна здійснити через офіційний сайт Житомирської "
    "міської ради zt-rada.gov.ua (розділ «ЦНАП») або електронною поштою "
    "administrator-cnap@ukr.net.\n\n"
    "Через ЦНАП надаються адміністративні послуги виконавчих органів міської ради, обласної "
    "державної адміністрації та центральних органів виконавчої влади (реєстрація, довідки, "
    "дозволи тощо). Частину цифрових послуг можна також отримати без відвідування ЦНАП через "
    "застосунок «Дія».\n\n"
    "Загальні контакти Житомирської міської ради: адреса м. Житомир, майдан ім. С. П. "
    "Корольова, 4/2; телефон (0412) 48-11-87; міська гаряча лінія (0412) 481-481; довідкова "
    "служба міста 15-80."
)

_EMERGENCY_TEXT = (
    "Екстрені служби, доступні у Житомирі (єдині номери, що діють по всій Україні):\n"
    "101 - виклик пожежної служби (ДСНС)\n"
    "102 - виклик поліції\n"
    "103 - виклик швидкої медичної допомоги\n"
    "104 - аварійна газова служба\n\n"
    "Єдиний номер екстреної допомоги 112 діє як уніфікований контакт-центр у частині "
    "регіонів України.\n\n"
    "Усі перелічені номери безкоштовні та доступні цілодобово з будь-якого мобільного чи "
    "стаціонарного телефону."
)

# document_id stays stable across runs — ingest_service's dedup is keyed on content hash per
# document_id, so re-running this script after an edit to the text above correctly re-ingests only
# the changed document, and re-running it unchanged is a safe no-op (status: "duplicate").
_DOCUMENTS = [
    ("manual-cnap-facts-2026-07", _CNAP_TEXT),
    ("manual-emergency-numbers-2026-07", _EMERGENCY_TEXT),
]


def _ingest(base_url: str, token: str, document_id: str, text: str) -> dict[str, object]:
    payload = {
        "document_id": document_id,
        "text": text,
        "doc_type": "instruction",
        "source": "manual-curated",
    }
    req = urllib.request.Request(
        f"{base_url}/api/v1/knowledge/ingest",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "X-Internal-Token": token},
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument(
        "--token", default=os.environ.get("INTERNAL_TOKEN"),
        help="Defaults to the INTERNAL_TOKEN env var (matches ml-service/.env's own value).",
    )
    args = parser.parse_args()
    if not args.token:
        parser.error("--token or the INTERNAL_TOKEN env var is required")

    for document_id, text in _DOCUMENTS:
        try:
            result = _ingest(args.base_url, args.token, document_id, text)
        except urllib.error.HTTPError as exc:
            print(f"{document_id}: FAILED ({exc.code} {exc.read().decode('utf-8', 'replace')})")
            continue
        print(f"{document_id}: {result['status']} ({result['chunks_processed']} chunks)")


if __name__ == "__main__":
    main()
