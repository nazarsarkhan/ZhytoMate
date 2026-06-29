"""
Purpose:   asyncpg pool + register_vector; HYBRID retrieval — dense KNN (embedding <=> $vec) AND lexical (websearch_to_tsquery('simple', $q) ranked by ts_rank_cd) returned as two ranked legs for RRF fusion, all inside ONE tx with SET LOCAL ef_search/iterative_scan (§2.8). Also: upsert, reaper SQL, and the atomic rate_limit upsert (INCR per window) backing the distributed limiter. Implements protocols.Retriever.
Layer:     component
May import:   app.config, app.protocols, domain/* (types); asyncpg, pgvector (the one resource this wraps)
Must NOT import:  services/*, api/*, pipeline/*, other components/*
"""
