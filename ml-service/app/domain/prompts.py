"""
Purpose:   RAG + vision prompt templates with strict context/question separation (anti-injection system instruction). PLUS the agent-branch prompts: build_decompose_prompt (split a multi-intent question into <= N independent sub-queries) and build_synthesis_prompt (fuse the per-sub-query contexts into one grounded, sourced answer).
Layer:     domain
May import:   stdlib, schemas/common (category enum for the vision schema text)
Must NOT import:  api/*, services/*, components/*, pipeline/*; any I/O or model lib (asyncpg, google-genai, sentence-transformers, FastAPI)
"""
