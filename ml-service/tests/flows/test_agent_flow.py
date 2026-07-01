"""
Purpose:   Flow (fake Generator + deterministic embeddings): the agent proof. A multi-intent query decomposes into <= AGENT_MAX_SUBQUERIES sub-queries, each retrieves in parallel, results merge+dedup, and one synthesis call returns a grounded answer; a dry sub-query is re-queried at most once. Asserts AGENT_RAG_ENABLED=false falls back to SimpleRAGPipeline, and the shared tail holds (empty retrieval => Generator NOT called; Generator error => extractive fallback).
Layer:     test
May import:   pytest, app.pipeline/*, app.services.rag_service, tests.fakes.fake_generator, tests.fakes.fake_embedder
Must NOT import:  real google-genai; live network
"""
