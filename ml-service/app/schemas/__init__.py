"""
Purpose:   Package marker for schemas/* (request/response DTOs — the only place raw bodies become
           typed models).
Layer:     schema
May import:   stdlib, pydantic, schemas/common
Must NOT import:  api/*, services/*, components/*, domain/*; any I/O or model lib (asyncpg, FastAPI
              routing)
"""
