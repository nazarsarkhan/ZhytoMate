"""
Purpose:   Vision orchestration: decode -> build strict prompt -> generate(json schema) -> validate -> retry once -> is_valid:false.
Layer:     service
May import:   domain/* (prompts), schemas/vision, gemini INTERFACE (injected), app.errors
Must NOT import:  other services/*, api/*, FastAPI/Starlette, asyncpg, google-genai, sentence-transformers (use injected components)
"""
