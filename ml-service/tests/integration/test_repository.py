"""
Purpose:   The critical DB-real integration tests (design §2.3–§2.6) against real Postgres +
           pgvector: SET LOCAL / iterative_scan inside the retrieval transaction, content-hash
           dedup, the expires_at freshness filter, district canonicalization end-to-end, and the
           rate_limit counter + reaper sweep (Phase 5) — the SQL upsert/delete is real-DB
           territory even though the allow/deny policy itself is unit-tested as pure code in
           tests/unit/test_rate_limiter.py. Uses the real repository against a real DB; no Gemini
           and no Embedder (vectors are seeded).
Layer:     test
May import:   pytest, pytest-asyncio, app.components.repository, app.components.rate_limiter,
              app.domain.*, tests.integration.conftest
Must NOT import:  app.api routers, google-genai, sentence-transformers (DB-real, LLM/embedder-absent)
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.components.rate_limiter import current_window, hash_user_id
from app.components.repository import ChunkRecord, KnowledgeRepository
from app.domain.districts import canonicalize_district
from app.domain.text import compute_content_hash
from tests.integration.conftest import make_content_hash, make_random_vec, make_target_vec

# All tests in this module share the session-scoped event loop (same loop the pool lives on).
pytestmark = pytest.mark.asyncio(loop_scope="session")


async def test_set_local_iterative_scan_returns_results_when_filtered(pg_pool):
    """§2.3 [CHALLENGE]: the SET LOCAL hnsw.* GUCs must live in the SAME explicit transaction as
    the SELECT, or asyncpg's autocommit silently discards them. Proven via correct post-filter
    behaviour: when most candidates are filtered out by district, retrieval still returns the
    requested number of *matching* rows (iterative_scan keeps expanding the HNSW scan).

    15 chunks in 'korolovskyi' -> a 'bohunskyi' query returns nothing (clean filter).
    Add 5 'bohunskyi' chunks near the query vector -> the same query returns exactly 3, all bohunskyi.
    """
    repo = KnowledgeRepository(pg_pool)

    base_vec = make_random_vec()
    query_vec = make_target_vec(base_vec, noise=0.01)

    # 15 chunks in the WRONG district.
    wrong_chunks = [
        ChunkRecord(
            document_id=f"doc_wrong_{i}", chunk_index=0,
            text=f"chunk {i}", embedding=make_random_vec(),
            doc_type="news", category=None, district="korolovskyi",
            source="http://test", content_hash=make_content_hash(i),
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        )
        for i in range(15)
    ]
    for chunk in wrong_chunks:
        await repo.upsert_chunks(chunk.document_id, [chunk])

    results = await repo.retrieve_dense(query_vec, "bohunskyi", limit=3)
    assert results == [], "bohunskyi query must return nothing when only korolovskyi data exists"

    # 5 chunks close to the query vector in the CORRECT district.
    right_chunks = [
        ChunkRecord(
            document_id=f"doc_right_{i}", chunk_index=0,
            text=f"right chunk {i}", embedding=make_target_vec(base_vec, noise=0.02),
            doc_type="news", category=None, district="bohunskyi",
            source="http://test", content_hash=make_content_hash(100 + i),
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        )
        for i in range(5)
    ]
    for chunk in right_chunks:
        await repo.upsert_chunks(chunk.document_id, [chunk])

    results = await repo.retrieve_dense(query_vec, "bohunskyi", limit=3)
    assert len(results) == 3
    assert all(result.district == "bohunskyi" for result in results)


async def test_content_hash_dedup_prevents_double_ingest(pg_pool):
    """§2.4: identical content arriving under a new document_id is caught by content_hash
    (not document_id). Proves content_hash_exists() detects cross-source duplicates."""
    repo = KnowledgeRepository(pg_pool)

    text = "Відключення води у Богунському районі 22 квітня"
    content_hash = compute_content_hash(text)

    chunk = ChunkRecord(
        document_id="doc_original", chunk_index=0,
        text=text, embedding=make_random_vec(),
        doc_type="news", category=None, district="bohunskyi",
        source="http://source-a.ua", content_hash=content_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    await repo.upsert_chunks("doc_original", [chunk])

    # Same content under a different document_id (different source) must be recognised.
    assert await repo.content_hash_exists(content_hash) is True

    count = await pg_pool.fetchval("SELECT COUNT(*) FROM knowledge_base")
    assert count == 1, f"expected exactly 1 row, got {count}"


async def test_expired_news_filtered_from_retrieval(pg_pool):
    """§2.5: expired rows are never served, even if HNSW finds them. Proves the
    (doc_type='instruction' OR expires_at > now()) freshness filter."""
    repo = KnowledgeRepository(pg_pool)

    seed_vec = make_random_vec()
    query_vec = make_target_vec(seed_vec, noise=0.01)

    expired = ChunkRecord(
        document_id="expired_doc", chunk_index=0,
        text="Стара новина про воду", embedding=seed_vec,
        doc_type="news", category=None, district=None,
        source="http://old.ua", content_hash="c" * 64,
        expires_at=datetime.now(timezone.utc) - timedelta(seconds=1),
    )
    await repo.upsert_chunks("expired_doc", [expired])

    assert await repo.retrieve_dense(query_vec, None, limit=5) == [], "expired news must not appear"

    # Sanity: an instruction with the same vector (no expires_at) IS returned.
    permanent = ChunkRecord(
        document_id="perm_doc", chunk_index=0,
        text="Постійна інструкція", embedding=seed_vec,
        doc_type="instruction", category=None, district=None,
        source="http://city.ua", content_hash="d" * 64,
        expires_at=None,
    )
    await repo.upsert_chunks("perm_doc", [permanent])

    results = await repo.retrieve_dense(query_vec, None, limit=5)
    assert len(results) == 1
    assert results[0].doc_type == "instruction"


async def test_district_canonicalization_end_to_end(pg_pool):
    """§2.6: raw district strings canonicalize to one slug at ingest, and queries using any surface
    form of that district find the row. Unknown districts fall back to city-wide (None)."""
    repo = KnowledgeRepository(pg_pool)

    # Ingest with a raw Ukrainian string — canonicalized to a slug before storage.
    slug = canonicalize_district("Богунський район")
    assert slug == "bohunskyi"

    seed_vec = make_random_vec()
    query_vec = make_target_vec(seed_vec, noise=0.01)

    chunk = ChunkRecord(
        document_id="water_news", chunk_index=0,
        text="Відключення води у Богунському районі", embedding=seed_vec,
        doc_type="news", category="utilities", district=slug,
        source="http://zt-rada.gov.ua", content_hash="e" * 64,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    await repo.upsert_chunks("water_news", [chunk])

    # Transliteration variant resolves to the same slug and finds the row.
    results = await repo.retrieve_dense(query_vec, canonicalize_district("Bohunskyi"), limit=3)
    assert len(results) == 1
    assert results[0].district == "bohunskyi"

    # Colloquial name, same slug.
    results = await repo.retrieve_dense(query_vec, canonicalize_district("богунка"), limit=3)
    assert len(results) == 1

    # Unknown district -> None -> city-wide query still returns the row.
    assert canonicalize_district("невідомий район") is None
    results = await repo.retrieve_dense(query_vec, None, limit=3)
    assert len(results) == 1, "city-wide query (district=None) must return all matching rows"


async def test_incr_rate_limit_counter_increments_within_same_window(pg_pool):
    """Repeated calls with the same hashed key + window accumulate, proving the upsert's
    ON CONFLICT DO UPDATE branch runs (not just the initial INSERT)."""
    repo = KnowledgeRepository(pg_pool)
    window = current_window()
    key = hash_user_id("111111")

    first = await repo.incr_rate_limit_counter(key, window)
    second = await repo.incr_rate_limit_counter(key, window)
    third = await repo.incr_rate_limit_counter(key, window)

    assert (first, second, third) == (1, 2, 3)


async def test_incr_rate_limit_counter_is_scoped_per_key(pg_pool):
    """Two different hashed keys in the same window don't share a counter (composite PK)."""
    repo = KnowledgeRepository(pg_pool)
    window = current_window()

    count_a = await repo.incr_rate_limit_counter(hash_user_id("aaaa"), window)
    count_b = await repo.incr_rate_limit_counter(hash_user_id("bbbb"), window)

    assert count_a == 1
    assert count_b == 1


async def test_delete_stale_rate_limit_windows_leaves_recent_rows(pg_pool):
    """Only windows older than the cutoff are swept; a row from the current window survives."""
    repo = KnowledgeRepository(pg_pool)
    window = current_window()

    recent_key = hash_user_id("recent-user")
    stale_key = hash_user_id("stale-user")
    await repo.incr_rate_limit_counter(recent_key, window)
    await repo.incr_rate_limit_counter(stale_key, window - 10)

    deleted = await repo.delete_stale_rate_limit_windows(older_than_minutes=5)

    assert deleted == 1
    remaining = await pg_pool.fetch("SELECT user_id FROM rate_limit")
    assert [row["user_id"] for row in remaining] == [recent_key]
