"""
Purpose:   Deterministic text normalize/clean + sha256 content_hash over the normalized FULL
           document. Same input always yields the same output (the dedup key depends on it, §2.4).
Layer:     domain
May import:   stdlib (re, hashlib, unicodedata)
Must NOT import:  api/*, services/*, components/*; any I/O or model lib (asyncpg, FastAPI)
"""
from __future__ import annotations

import hashlib
import re
import unicodedata

# Horizontal whitespace (tabs, CR, NBSP, form-feed, ...) but NOT newlines — paragraph breaks
# survive.
_HORIZONTAL_WS_RE = re.compile(r"[^\S\n]+")
# Spaces hugging a newline collapse onto the newline (avoids trailing spaces from CRLF input).
_NEWLINE_PAD_RE = re.compile(r" *\n *")
# Three or more newlines collapse to a single paragraph break.
_PARAGRAPH_RE = re.compile(r"\n{3,}")


def normalize_text(text: str) -> str:
    """
    Clean raw scraped text for storage and hashing.

    Steps: (1) Unicode NFC, (2) collapse every non-newline whitespace run (tab, CR, NBSP, ...) to a
    single space, (3) drop spaces around newlines, (4) collapse 3+ newlines to a paragraph break,
    (5) strip ends. Empty input returns "".
    """
    if not text:
        return ""
    text = unicodedata.normalize("NFC", text)
    text = _HORIZONTAL_WS_RE.sub(" ", text)
    text = _NEWLINE_PAD_RE.sub("\n", text)
    text = _PARAGRAPH_RE.sub("\n\n", text)
    return text.strip()


def compute_content_hash(text: str) -> str:
    """
    SHA-256 hex digest of the normalized full-document text. Normalizes internally — callers pass
    the raw text and must NOT pre-normalize. Returns a 64-char lowercase hex string.
    """
    return hashlib.sha256(normalize_text(text).encode("utf-8")).hexdigest()
