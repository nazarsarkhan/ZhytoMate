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

# Queries with no result above sim_gate (the no-info path; the LLM is not called).
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
