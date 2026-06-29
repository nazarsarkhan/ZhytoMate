"""
Purpose:   Per-user rate-limit POLICY (abuse protection): hash user_id, compute the fixed window, decide allow/deny + Retry-After from a count. PURE policy, stdlib only — the count is persisted in Postgres (repository.incr_rate_limit) so the limiter is SHARED across replicas; the service is genuinely stateless/N-replica safe (ADR-009 rev). The global free-tier limiter is gone (paid tier).
Layer:     component
May import:   app.config; stdlib only (window math + hashing; the counter store is the repository's, applied by the query dependency)
Must NOT import:  services/*, api/*, pipeline/*, other components/* (including repository — deps wires count + policy together)
"""
