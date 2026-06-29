"""
Purpose:   pydantic-settings Settings: env + ALL tunables. Existing (SIM_GATE, SIM_HIGH, ef_search, ttl, timeouts, pool sizes) PLUS R2RAG/hybrid additions: LLM_MODEL (env-only), COMPLEXITY_WORD_THRESHOLD, COMPLEX_KEYWORDS, AGENT_RAG_ENABLED, AGENT_MAX_SUBQUERIES, RRF_K, DENSE_TOPN, LEXICAL_TOPN, RATE_LIMIT_WINDOW_S, RATE_LIMIT_MAX.
Layer:     infra
May import:   stdlib, pydantic, pydantic-settings
Must NOT import:  any app.* module (config is a leaf — everything imports it; it imports nothing internal)
"""
