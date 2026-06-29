"""
Purpose:   Scriptable/raising fake Gemini client matching the gemini component interface (canned text or injected error).
Layer:     test
May import:   stdlib, app.components.gemini (interface/type only), schemas/*
Must NOT import:  google-genai (the whole point is to avoid the real LLM in CI)
"""
