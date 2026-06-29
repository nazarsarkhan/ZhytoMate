"""
Purpose:   FastAPI dependencies: auth (X-Internal-Token) + per-user rate-limit enforcement (rate_limiter policy + repository counter) + typed accessors pulled from app.state, including the two pipelines wired into RagService (SimpleRAGPipeline, AgentRAGPipeline).
Layer:     api
May import:   FastAPI, app.config, app.errors, services/* + components/* + pipeline/* (typing only, for accessors), schemas/*
Must NOT import:  api/v1/* routers (avoid cycles); domain/* directly; the hosted-LLM SDK, asyncpg, sentence-transformers
"""
