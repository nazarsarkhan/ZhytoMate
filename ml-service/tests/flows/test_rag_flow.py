"""
Purpose:   Flow: empty retrieval => Gemini NOT called (call-count 0); gated context => generate; Gemini error => extractive fallback.
Layer:     test
May import:   pytest, app.services.rag_service, tests.fakes.fake_gemini, tests.fakes.fake_embedder, app.schemas/*
Must NOT import:  real google-genai, real sentence-transformers (injected fakes only)
"""
