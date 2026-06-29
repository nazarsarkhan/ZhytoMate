"""
Purpose:   Deterministic hash-based fake embedder matching the embedder interface (fast, no model load in CI).
Layer:     test
May import:   stdlib, numpy, app.components.embedder (interface/type only)
Must NOT import:  sentence-transformers, torch (the whole point is to avoid loading the real model in CI)
"""
