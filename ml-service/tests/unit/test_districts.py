"""
Purpose:   Unit: three spellings ("Богунський район" / "Bohunskyi" / "богунка") canonicalize to one
           slug; unknown -> None (FIX-3 regression guard, §2.6).
Layer:     test
May import:   pytest, app.domain.districts, stdlib
Must NOT import:  app.api, app.services, app.components; asyncpg, google-genai (pure/fast unit test)
"""
from __future__ import annotations

import pytest

from app.domain.districts import KNOWN_SLUGS, canonicalize_district


@pytest.mark.parametrize(
    "raw",
    ["Богунський район", "Bohunskyi", "богунка", "  БОГУНСЬКИЙ  ", "bogunsky"],
)
def test_bohunskyi_surface_forms_collapse_to_one_slug(raw: str) -> None:
    assert canonicalize_district(raw) == "bohunskyi"


@pytest.mark.parametrize(
    "raw",
    ["Корольовський район", "Korolovskyi", "корольовського", "королевский"],
)
def test_korolovskyi_surface_forms_collapse_to_one_slug(raw: str) -> None:
    assert canonicalize_district(raw) == "korolovskyi"


@pytest.mark.parametrize("raw", [None, "", "   ", "Центр", "unknownville"])
def test_unknown_or_blank_maps_to_none(raw: str | None) -> None:
    assert canonicalize_district(raw) is None


def test_every_mapped_value_is_a_known_slug() -> None:
    assert canonicalize_district("Bohunskyi") in KNOWN_SLUGS
    assert canonicalize_district("Korolovskyi") in KNOWN_SLUGS
