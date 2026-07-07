"""
Purpose:   Custom Prometheus business metrics (§7), defined ONCE here and imported by the services
           that emit them. They register on the default registry, which the /metrics endpoint
           (exposed by prometheus-fastapi-instrumentator in main.py) scrapes.
Layer:     infra (leaf — imported by services and the composition root)
May import:   prometheus_client
Must NOT import:  app.* (keep it a leaf to avoid import cycles)
"""
from __future__ import annotations

from prometheus_client import Counter, Histogram

# LLM call outcomes per route. outcome: ok | fallback
llm_calls = Counter(
    "zhytomate_llm_calls_total",
    "LLM API calls",
    ["route", "outcome"],
)

# Distribution of dense top-1 cosine similarity (the confidence gate signal).
retrieval_top1_sim = Histogram(
    "zhytomate_retrieval_top1_similarity",
    "Top-1 cosine similarity of dense retrieval",
    buckets=[0.5, 0.6, 0.7, 0.75, 0.78, 0.82, 0.85, 0.9, 0.95, 1.0],
)

# Queries with no result above sim_gate — retrieval was insufficient to ground an answer, so the
# pipeline answers via the ungrounded/general-conversation fallback instead of a grounded one (the
# LLM is still called either way; this metric tracks retrieval coverage, not whether it answered).
retrieval_empty = Counter(
    "zhytomate_retrieval_empty_total",
    "Queries that returned no results above sim_gate",
)

# Raw district strings that matched no canonical slug. boundary: ingest | query
district_unmapped = Counter(
    "zhytomate_district_unmapped_total",
    "Raw district strings that matched no canonical slug",
    ["boundary"],
)

# Responses served via extractive fallback. reason: llm_error | llm_timeout | llm_quota
degraded_responses = Counter(
    "zhytomate_degraded_responses_total",
    "Responses served via extractive fallback",
    ["reason"],
)

# Queries classified by route (SIMPLE | COMPLEX), regardless of which pipeline actually ran —
# a COMPLEX query still counts as COMPLEX here even when it falls back to SimpleRAGPipeline.
query_route_total = Counter(
    "zhytomate_query_route_total", "Queries classified by route", ["route"]
)

# How many sub-queries AgentRAGPipeline's decomposition step produced for a COMPLEX request.
agent_subqueries = Histogram(
    "zhytomate_agent_subqueries", "Number of sub-queries produced by agent decomposition",
    buckets=[1, 2, 3, 4, 5],
)

# Generator.generate() call latency (success and failure both observed — see pipeline/base.py).
llm_latency_seconds = Histogram(
    "zhytomate_llm_latency_seconds", "Generator.generate() call latency"
)

# OpenAI embeddings API call latency (one observation per network attempt, retries included).
embedding_latency_seconds = Histogram(
    "zhytomate_embedding_latency_seconds", "OpenAI embeddings API call latency"
)

# Query-embedding LRU cache hits.
embedding_cache_hits_total = Counter(
    "zhytomate_embedding_cache_hits_total", "Query-embedding LRU cache hits"
)

# Query-embedding LRU cache lookups (hit or miss) — divide hits by this in PromQL for hit ratio.
embedding_cache_lookups_total = Counter(
    "zhytomate_embedding_cache_lookups_total", "Query-embedding LRU cache lookups (hit or miss)"
)

# Hits contributed by each retrieval leg. leg: dense | lexical
retrieval_leg_hits = Counter(
    "zhytomate_retrieval_leg_hits_total", "Hits contributed by each retrieval leg", ["leg"]
)

# Chunks written during ingest.
ingest_chunks_total = Counter(
    "zhytomate_ingest_chunks_total", "Chunks written during ingest"
)

# Ingest requests short-circuited by a duplicate content hash.
dedup_skips_total = Counter(
    "zhytomate_dedup_skips_total", "Ingest requests short-circuited by a duplicate content hash"
)

# Queries refused by the OPSEC content-safety gate. layer: heuristic | llm | llm_error
queries_blocked_total = Counter(
    "zhytomate_queries_blocked_total", "Queries refused by the OPSEC content-safety gate", ["layer"]
)

# Slot-extraction replies action_service.py had to correct before returning them — both are the
# same hazard (an uncorrected reply round-tripping back in as a future request's current_slots and
# failing that request's own validation forever). kind: value_truncated | unexpected_key
slot_extraction_anomalies_total = Counter(
    "zhytomate_slot_extraction_anomalies_total",
    "Slot-extraction replies that needed correction before being returned",
    ["kind"],
)
