"""
Purpose:   Hosted LLM client (provider-agnostic): implements protocols.Generator AND protocols.VisionGenerator with ONE multimodal model covering RAG generation, agent decompose/synthesis, and vision analysis. Timeouts + tenacity retry/backoff (transient classes only). Model id + provider come from Settings/env ONLY (never committed — CLAUDE.md). Paid tier => rate-limiting no longer binds (ADR-003 rev / ADR-009 rev).
Layer:     component
May import:   app.config, app.protocols, domain/* (types); the hosted-LLM SDK, tenacity (the one resource this wraps)
Must NOT import:  services/*, api/*, pipeline/*, other components/*
"""
