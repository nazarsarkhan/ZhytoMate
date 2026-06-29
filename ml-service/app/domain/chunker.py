"""
Purpose:   Token-aware chunking (target 380 / hard-max 480 / overlap 50) measured on an injected e5 tokenizer.
Layer:     domain
May import:   stdlib, schemas/common
Must NOT import:  api/*, services/*, components/*; transformers/sentence-transformers (the tokenizer is passed in as a callable to keep this pure and unit-testable)
"""
