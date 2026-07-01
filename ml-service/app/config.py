"""
Purpose:   pydantic-settings Settings (env + tunables) and a cached get_settings() singleton.
Layer:     infra
May import:   stdlib, pydantic, pydantic-settings
Must NOT import:  any app.* module (config is a leaf — everything imports it; it imports nothing internal)
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

    # RAG tuning — PROVISIONAL placeholders for the NEW embedding space. MUST re-calibrate via
    # scripts/calibrate_thresholds.py: text-embedding-3-large's similarity distribution differs
    # from e5, so the old 0.78/0.85 values are no longer valid (§2.7).
    sim_gate: float = 0.70
    sim_high: float = 0.80

    # Rate limiting (Postgres-backed, ADR-009 rev)
    rate_limit_per_minute: int = 10

    # Feature flags
    agent_rag_enabled: bool = False  # COMPLEX queries fall back to SIMPLE when False

    # Performance / caching
    embed_cache_maxsize: int = 1000
    answer_cache_ttl_seconds: int = 120
    answer_cache_maxsize: int = 200
    rrf_k: int = 60                  # RRF smoothing constant

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


@lru_cache
def get_settings() -> Settings:
    """Cached singleton — Settings is read from env/.env once per process."""
    return Settings()
