"""
Purpose:   Structured JSON logging setup; user_id always logged hashed, user_query only at DEBUG.
Layer:     observability
May import:   app.config; stdlib logging / structlog
Must NOT import:  api/*, services/*, components/*, domain/*
"""
