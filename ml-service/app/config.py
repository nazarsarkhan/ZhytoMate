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
    gemini_api_key: str
    internal_token: str
    gemini_model: str  # hosted-LLM model id — env only, never a committed default (DO NOT rule)

    # Model
    embed_model: str = "intfloat/multilingual-e5-base"

    # RAG tuning — PROVISIONAL; calibrate via scripts/calibrate_thresholds.py before demo (§2.7)
    sim_gate: float = 0.78
    sim_high: float = 0.85

    # Rate limiting (Postgres-backed, ADR-009 rev)
    rate_limit_per_minute: int = 10

    # Feature flags
    agent_rag_enabled: bool = False  # COMPLEX queries fall back to SIMPLE when False

    # Performance
    torch_num_threads: int = 4       # applied via torch.set_num_threads in Embedder (not an env var)
    embed_cache_maxsize: int = 1000
    answer_cache_ttl_seconds: int = 120
    answer_cache_maxsize: int = 200
    rrf_k: int = 60                  # RRF smoothing constant

    # Offline mode — set to 1 in Docker to prevent any HF download during the demo
    transformers_offline: int = 1
    hf_datasets_offline: int = 1

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


@lru_cache
def get_settings() -> Settings:
    """Cached singleton — Settings is read from env/.env once per process."""
    return Settings()
