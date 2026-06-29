"""
Purpose:   SimpleRAGPipeline(RAGPipeline): single-shot path for SIMPLE queries — embed('query: …') -> hybrid retrieve (dense+lexical, RRF) -> assemble_context -> shared tail (confidence gate; generate or no-info; extractive fallback on LLM error). One Generator call max.
Layer:     pipeline
May import:   pipeline/base, protocols (Embedder/Retriever/Generator), domain/{fusion,context,confidence}, schemas/*
Must NOT import:  api/*, services/*; concrete components/*; FastAPI, asyncpg, google-genai, sentence-transformers
"""
