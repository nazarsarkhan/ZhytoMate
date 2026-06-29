"""
Purpose:   /health/live (process up), /health/ready (model loaded + DB reachable), /health/deps (Gemini + pool stats).
Layer:     api
May import:   FastAPI (APIRouter), app.deps (component accessors for readiness probes), app.errors
Must NOT import:  components/* or repository directly (probe via app.deps accessors); domain/* directly; services/*
"""
