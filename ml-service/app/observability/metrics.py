"""
Purpose:   Prometheus instrumentator + custom metrics. Existing (district_unmapped_total, retrieval_empty_total, degraded_responses_total, ...) PLUS R2RAG/hybrid: query_route_total{route}, agent_subqueries (histogram), retrieval_leg_hits{leg=dense|lexical}, eval_retrieval_hitrate (set by the eval harness).
Layer:     observability
May import:   app.config; prometheus-fastapi-instrumentator, prometheus_client
Must NOT import:  api/*, services/*, components/*, pipeline/*, domain/*
"""
