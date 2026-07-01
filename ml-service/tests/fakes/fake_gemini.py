"""
Purpose:   Scriptable/raising fake OpenAI client matching the chat-completions interface used by the
           services (canned content or injected error). Keeps CI offline — no real LLM calls.
Layer:     test
May import:   stdlib, app.services (interface/type only), schemas/*
Must NOT import:  openai (the whole point is to avoid the real LLM in CI)
"""
