"""Deterministic catalog of user-facing Zhytomate capabilities.

This metadata is navigation, not factual evidence. It deliberately contains no admin routes and
never accepts a route supplied by a language model.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.schemas.query import AppLink


@dataclass(frozen=True)
class _Capability:
    capability: str
    label: str
    route: str
    reason: str
    aliases: tuple[str, ...]


_CAPABILITIES: tuple[_Capability, ...] = (
    _Capability(
        "transport",
        "Транспорт",
        "/services/transport",
        "Переглянути маршрути та транспорт Житомира",
        (
            "транспорт",
            "маршрут",
            "маршрутка",
            "тролейбус",
            "автобус",
            "зупинк",
            "проїзд",
            "транспорт",
            "маршрут",
            "троллейбус",
            "автобус",
            "transport",
            "bus",
            "route",
        ),
    ),
    _Capability(
        "contacts",
        "Контакти",
        "/services/contacts",
        "Знайти контакти міських служб",
        (
            "контакт",
            "телефон служби",
            "гаряча лінія",
            "контакты",
            "телефоны служб",
            "contacts",
        ),
    ),
    _Capability(
        "appeals",
        "Звернення",
        "/services/appeals",
        "Подати або переглянути звернення",
        (
            "звернен",
            "скарг",
            "повідомити про проблему",
            "обращен",
            "жалоб",
            "appeal",
        ),
    ),
    _Capability(
        "polls",
        "Опитування",
        "/services/polls",
        "Відкрити міські опитування",
        (
            "опитуван",
            "голосуван",
            "опрос",
            "голосован",
            "poll",
            "vote",
        ),
    ),
    _Capability(
        "outages",
        "Відключення",
        "/services/outages",
        "Переглянути графік відключень",
        (
            "відключен",
            "відключенн",
            "світло",
            "електроенерг",
            "отключен",
            "свет",
            "outage",
        ),
    ),
    _Capability(
        "places",
        "Місця",
        "/places",
        "Знайти потрібні місця у Житомирі",
        (
            "місц",
            "кафе",
            "ресторан",
            "супермаркет",
            "магазин",
            "де поїсти",
            "поїсти",
            "мест",
            "кафе",
            "где поесть",
            "пойти поесть",
            "places",
            "restaurant",
        ),
    ),
    _Capability(
        "news",
        "Новини",
        "/news",
        "Переглянути новини Житомира",
        (
            "новин",
            "останні події",
            "що нового",
            "новости",
            "последние новости",
            "что нового",
            "news",
        ),
    ),
    _Capability(
        "notifications",
        "Сповіщення",
        "/notifications",
        "Відкрити сповіщення",
        ("сповіщен", "уведомлен", "notifications", "alerts"),
    ),
    _Capability(
        "profile",
        "Профіль",
        "/profile",
        "Відкрити профіль мешканця",
        (
            "профіл",
            "мій акаунт",
            "профиль",
            "мой аккаунт",
            "profile",
            "account",
        ),
    ),
    _Capability(
        "history",
        "Історія чатів",
        "/chat-history",
        "Переглянути історію чатів",
        (
            "історі",
            "истори",
            "chat history",
            "chat-history",
        ),
    ),
    _Capability(
        "services",
        "Міські сервіси",
        "/services",
        "Відкрити каталог міських сервісів",
        (
            "міські сервіс",
            "городские сервис",
            "city services",
            "services",
        ),
    ),
)

_ALLOWED_ROUTES = frozenset(capability.route for capability in _CAPABILITIES)


def _normalize(value: str) -> str:
    return re.sub(r"[^\w\s-]", " ", value.casefold(), flags=re.UNICODE)


def validate_app_route(route: str) -> str | None:
    """Return a route only when it is an exact, safe user-facing app route."""
    if not isinstance(route, str) or not route or any(char.isspace() for char in route):
        return None
    if any(char in route for char in "\r\n\t") or route.startswith(
        ("//", "http:", "https:", "javascript:")
    ):
        return None
    if route.startswith("/admin"):
        return None
    return route if route in _ALLOWED_ROUTES else None


def match_app_capabilities(query: str) -> list[AppLink]:
    """Find up to three high-signal capabilities from a resident's wording."""
    if not isinstance(query, str) or not query.strip():
        return []
    normalized = _normalize(query)
    scored: list[tuple[int, int, _Capability]] = []
    for order, capability in enumerate(_CAPABILITIES):
        matches = [alias for alias in capability.aliases if _normalize(alias) in normalized]
        if matches:
            score = max(len(_normalize(alias)) for alias in matches)
            scored.append((score, -order, capability))
    scored.sort(reverse=True, key=lambda item: (item[0], item[1]))
    links: list[AppLink] = []
    seen_routes: set[str] = set()
    for _, _, capability in scored:
        route = validate_app_route(capability.route)
        if route is None or route in seen_routes:
            continue
        links.append(
            AppLink(
                capability=capability.capability,
                label=capability.label,
                route=route,
                reason=capability.reason,
            )
        )
        seen_routes.add(route)
        if len(links) == 3:
            break
    return links
