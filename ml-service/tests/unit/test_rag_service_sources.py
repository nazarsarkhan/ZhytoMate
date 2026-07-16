from types import SimpleNamespace

from app.services.rag_service import _unique_sources


def test_unique_sources_removes_duplicate_chunk_sources_in_order():
    sources = [SimpleNamespace(source="manual-curated"), SimpleNamespace(source="manual-curated"), SimpleNamespace(source="https://zt-rada.gov.ua")]
    result = _unique_sources(sources)
    assert [item.source for item in result] == ["manual-curated", "https://zt-rada.gov.ua"]
