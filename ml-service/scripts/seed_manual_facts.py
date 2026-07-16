"""
Purpose:   Offline tool (NOT served): re-ingest a small set of manually-curated, static civic facts
           (CNAP address/hours/contacts, emergency phone numbers, current city-council leadership)
           that the parser's web/Telegram crawl does not reliably capture as clean, directly-
           answerable content — the source pages exist (e.g. zt-rada.gov.ua's own CNAP department
           page) but the parser only ever sees them buried in unrelated report/statistics documents,
           if at all. The leadership document is wartime-specific and more likely to go stale than
           the others (see its own comment below) — re-verify it periodically, not just after a
           reseed. Idempotent: POSTs to the
           already-running ml-service's own ingest endpoint (doc_type="instruction", so no ttl_days,
           no expiry) using document_id values stable across runs, so ingest_service's existing
           content-hash dedup makes a re-run a safe no-op unless the text actually changed. Exists
           specifically so a full KB reseed (TRUNCATE knowledge_base + re-run the parser, per the
           root CLAUDE.md's Demo Runbook) does not silently lose this content — run this script once
           after any such reseed.
           Run manually (ml-service must already be up):
             python scripts/seed_manual_facts.py [--base-url URL] [--token TOKEN]
Layer:     script  (composition root for an offline job; may wire concrete components, like main.py)
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
    "Графік роботи ЦНАП: понеділок - п'ятниця, з 8:30 до 17:30, обідня перерва "
    "з 12:30 до 13:30.\n\n"
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

_PASSPORT_TEXT = (
    "Де зробити паспорт у Житомирі: паспортні документи можна оформити, отримати або "
    "відновити у підрозділах "
    "Державної міграційної служби України, у ЦНАП або в Паспортному сервісі ДП «Документ». "
    "Це стосується паспорта громадянина України у формі ID-картки, обміну паспорта після "
    "досягнення відповідного віку, а також паспорта громадянина України для виїзду за кордон. "
    "Звернутися можна незалежно від місця реєстрації. У Житомирі підрозділи ДМС працюють "
    "за адресами: Богунський відділ — вул. Театральна, 17/20; Житомирський відділ — "
    "вул. Грушевського, 75/114; Корольовський відділ — площа Польова, 8. Перед візитом "
    "перевірте актуальний графік та запишіться через сервіс «Електронна черга». "
    "Консультації Управління ДМС у Житомирській області: (0412) 42-21-12. "
    "Актуальний перелік підрозділів і графік: https://dmsu.gov.ua/zhytomyr/pidrozdily.html."
)

_COURTS_TEXT = (
    "Де суд у Житомирі: суди в Житомирі. Житомирський районний суд Житомирської області "
    "розташований "
    "за адресою: 10031, м. Житомир, вул. Сосновського, 38. Житомирський окружний "
    "адміністративний суд має адреси: м. Житомир, вул. Бориса Лятошинського, 5 та "
    "вул. Мала Бердичівська, 17; телефон канцелярії (0412) 40-47-47. Перед візитом "
    "перевірте графік роботи та потрібний тип суду на офіційних сторінках судової влади. "
    "Житомирський районний суд: https://zt.zt.court.gov.ua/sud0608. "
    "Житомирський окружний адміністративний суд: "
    "https://adm.zt.court.gov.ua/sud0670/pro_sud/info_sud/836126."
)

_WATER_TEXT = (
    "Де купити питну воду в центрі Житомира: автомати «Аквабокс» працюють у торгових "
    "центрах та магазинах міста. У центральній частині є точки за адресами: ТРЦ «Глобал», "
    "вул. Київська, 77; «ЕКО-Маркет», вул. Мала Бердичівська, 2/7; ТЦ «ОЛДІ», "
    "вул. М. Грушевського, 5. Також автомати є в ТЦ «Новобуд», вул. Покровська, 63, "
    "та ТЦ «Дастор», вул. Домбровського, 3. Перед поїздкою перевірте актуальність точки "
    "у «Центрі фільтрації води»: https://center-vody.zt.ua/posluhy/akvaboks/."
)

_FOOD_TEXT = (
    "Куди піти поїсти в центрі Житомира: кав’ярня «Кофеджио» розташована на пішохідній "
    "вулиці Михайлівській, 3. Телефон: +38 (063) 393 50 04. Це один із закладів, "
    "описаних Житомирським туристичним інформаційним центром; перед візитом перевірте "
    "актуальний графік роботи. Джерело: "
    "https://tic.zt.ua/de-poisty/kafe/zhytomyrskyi-raion-kafe/172-kaviarnia-kofedzhyo."
)

_TRANSPORT_TEXT = (
    "Тролейбус №15А у Житомирі курсує за маршрутом «Гідропарк — вул. Селецька». "
    "Точний інтервал та час руху можуть змінюватися через сезонні графіки, ремонтні роботи "
    "та інші тимчасові зміни, тому перед поїздкою перевіряйте актуальні повідомлення КП "
    "«Житомирське трамвайно-тролейбусне управління» та міської ради. Офіційне рішення "
    "із переліком маршруту №15А: https://zt-rada.gov.ua/files/upload/sitefiles/doc1610705501.pdf."
)

# Wartime-specific and the most likely of these three to go stale: no elected mayor currently
# (martial law suspends elections), so this describes an acting arrangement, not a normal term of
# office. User-supplied and dated 2026-07 for exactly that reason — re-verify before reusing this
# past a change in the war's legal status or a reported personnel change.
_LEADERSHIP_TEXT = (
    # Opens with "Мер" (nominative, matching how a citizen would actually phrase "хто мер?")
    # alongside the formal "міський голова" - the 'simple' FTS config used by this KB does no
    # stemming, so "мера"/"мером" elsewhere in this text would NOT match a bare "мер" query.
    # Without this, the only real match for "мер" in the whole KB was an unrelated Telegram
    # story about Dortmund's own mayor visiting Zhytomyr, which the assistant genuinely (if
    # unhelpfully) answered from - a live-reproduced bug, not a hypothetical one.
    "Мер (міський голова) Житомира наразі офіційно не обраний. Попередній очільник міста "
    "Сергій Іванович Сухомлин достроково склав повноваження у вересні 2024 року та був "
    "призначений на посаду голови Державного агентства відновлення та розвитку "
    "інфраструктури України.\n\n"
    "Оскільки в умовах воєнного стану чергові вибори мера не проводяться, обов'язки міського "
    "голови виконує секретар міської ради Галина Степанівна Шиманська. До обрання секретарем "
    "міськради у 2024 році вона працювала завідувачкою житомирських дитячих садків.\n\n"
    "Перший заступник міського голови - Світлана Григорівна Ольшанська, курує питання "
    "бюджету, фінансів та економіки.\n\n"
    "Виконавчий комітет та депутатський корпус Житомирської міської ради продовжують "
    "повноцінно працювати для забезпечення життєдіяльності громади: затверджують бюджети, "
    "координують підтримку військових та роботу комунальних служб."
)

# document_id stays stable across runs — ingest_service's dedup is keyed on content hash per
# document_id, so re-running this script after an edit to the text above correctly re-ingests only
# the changed document, and re-running it unchanged is a safe no-op (status: "duplicate").
_DOCUMENTS = [
    ("manual-cnap-facts-2026-07", _CNAP_TEXT, "manual-curated"),
    ("manual-emergency-numbers-2026-07", _EMERGENCY_TEXT, "manual-curated"),
    ("manual-city-leadership-2026-07", _LEADERSHIP_TEXT, "manual-curated"),
    (
        "manual-passport-services-2026-07",
        _PASSPORT_TEXT,
        "https://dmsu.gov.ua/zhytomyr/pidrozdily.html",
    ),
    (
        "manual-zhytomyr-courts-2026-07",
        _COURTS_TEXT,
        "https://zt.zt.court.gov.ua/sud0608",
    ),
    ("manual-zhytomyr-water-2026-07", _WATER_TEXT, "https://center-vody.zt.ua/posluhy/akvaboks/"),
    (
        "manual-zhytomyr-food-2026-07",
        _FOOD_TEXT,
        "https://tic.zt.ua/de-poisty/kafe/zhytomyrskyi-raion-kafe/172-kaviarnia-kofedzhyo",
    ),
    (
        "manual-zhytomyr-trolleybus-15a-2026-07",
        _TRANSPORT_TEXT,
        "https://zt-rada.gov.ua/files/upload/sitefiles/doc1610705501.pdf",
    ),
]


def _ingest(
    base_url: str, token: str, document_id: str, text: str, source: str
) -> dict[str, object]:
    payload = {
        "document_id": document_id,
        "text": text,
        "doc_type": "instruction",
        "source": source,
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

    for document_id, text, source in _DOCUMENTS:
        try:
            result = _ingest(args.base_url, args.token, document_id, text, source)
        except urllib.error.HTTPError as exc:
            print(f"{document_id}: FAILED ({exc.code} {exc.read().decode('utf-8', 'replace')})")
            continue
        print(f"{document_id}: {result['status']} ({result['chunks_processed']} chunks)")


if __name__ == "__main__":
    main()
