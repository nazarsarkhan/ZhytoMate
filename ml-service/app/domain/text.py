"""
Purpose:   Text normalize/clean + sha256 content_hash over the normalized full document.
Layer:     domain
May import:   stdlib (re, hashlib, unicodedata)
Must NOT import:  api/*, services/*, components/*; any I/O or model lib (asyncpg, google-genai, sentence-transformers, FastAPI)
"""
