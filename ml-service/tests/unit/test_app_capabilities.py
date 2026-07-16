from app.domain.app_capabilities import match_app_capabilities, validate_app_route


def test_matches_transport_in_ukrainian_and_returns_internal_route() -> None:
    links = match_app_capabilities("Де подивитися маршрути та тролейбуси?")

    assert links[0].capability == "transport"
    assert links[0].route == "/services/transport"


def test_matches_supported_user_capabilities_in_multiple_languages() -> None:
    cases = {
        "де контакти міських служб": ("contacts", "/services/contacts"),
        "как подать обращение": ("appeals", "/services/appeals"),
        "where can I vote in polls": ("polls", "/services/polls"),
        "где посмотреть отключения света": ("outages", "/services/outages"),
        "де знайти кафе": ("places", "/places"),
        "останні новини": ("news", "/news"),
        "показати мої сповіщення": ("notifications", "/notifications"),
        "відкрити мій профіль": ("profile", "/profile"),
        "показати історію чатів": ("history", "/chat-history"),
    }

    for query, expected in cases.items():
        links = match_app_capabilities(query)
        assert links, query
        assert (links[0].capability, links[0].route) == expected


def test_unknown_query_returns_no_capability_links() -> None:
    assert match_app_capabilities("Яка погода завтра?") == []


def test_matches_natural_food_and_news_phrasings() -> None:
    assert match_app_capabilities("Куда пойти поесть в Житомире?")[0].route == "/places"
    assert match_app_capabilities("Що нового в Житомирі сьогодні?")[0].route == "/news"


def test_route_validator_rejects_admin_external_and_unknown_paths() -> None:
    assert validate_app_route("/services/transport") == "/services/transport"
    assert validate_app_route("/admin/users") is None
    assert validate_app_route("https://example.com") is None
    assert validate_app_route("//example.com") is None
    assert validate_app_route("/not-a-real-page") is None


def test_capability_links_are_deduplicated_and_capped() -> None:
    links = match_app_capabilities("транспорт, маршрути, зупинки, автобуси")

    assert len(links) <= 3
    assert len({link.route for link in links}) == len(links)
