"""
Purpose:   pydantic-settings Settings (env + tunables) and a cached get_settings() singleton.
Layer:     infra
May import:   stdlib, pydantic, pydantic-settings
Must NOT import:  any app.* module (config is a leaf — everything imports it; it imports nothing
              internal)
"""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Required (no defaults — startup fails fast if absent)
    database_url: str
    openai_api_key: str
    internal_token: str

    # Models
    llm_model: str = "gpt-4o-mini"
    embed_model: str = "text-embedding-3-large"

    # RAG tuning — calibrated via scripts/calibrate_thresholds.py against the seeded KB under
    # text-embedding-3-large (civic queries cluster ~0.56-0.70, off-topic ~0.31-0.41; see
    # ml-service/CLAUDE.md's Known Issues). These class defaults exist only as a fallback for a
    # process that somehow starts with no env value for these two keys — .env should always
    # supply them explicitly. Re-run the calibration script (and update both here and .env)
    # whenever the KB, embedding model, or chunking changes.
    sim_gate: float = 0.50
    sim_high: float = 0.62

    # Rate limiting (Postgres-backed, ADR-009 rev)
    rate_limit_per_minute: int = 10

    # Feature flags
    agent_rag_enabled: bool = False  # COMPLEX queries fall back to SIMPLE when False
    agent_max_subqueries: int = 3    # cap on AgentRAGPipeline's query-decomposition fan-out

    # Performance / caching
    embed_cache_maxsize: int = 1000
    answer_cache_ttl_seconds: int = 120
    answer_cache_maxsize: int = 200
    rrf_k: int = 60                  # RRF smoothing constant
    knowledge_base_version: int = 1  # incremented after successful ingest/delete

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


@lru_cache
def get_settings() -> Settings:
    """Cached singleton — Settings is read from env/.env once per process."""
    return Settings()
