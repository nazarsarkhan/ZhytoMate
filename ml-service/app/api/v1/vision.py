"""
Purpose:   POST /vision/analyze — validate mime + size, delegate to vision_service, return VisionResponse.
Layer:     api
May import:   FastAPI (APIRouter), schemas/vision, app.deps (vision_service accessor), app.errors
Must NOT import:  components/* or repository directly; domain/* directly (go through vision_service); google-genai, asyncpg, sentence-transformers
"""
