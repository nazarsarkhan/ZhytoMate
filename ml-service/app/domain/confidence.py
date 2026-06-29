"""
Purpose:   Map top-1 similarity -> confidence band (high / medium / no-info) using SIM_GATE / SIM_HIGH.
Layer:     domain
May import:   stdlib, schemas/common
Must NOT import:  api/*, services/*, components/*; any I/O or model lib (asyncpg, google-genai, sentence-transformers, FastAPI). Thresholds are passed in (sourced from config), not imported.
"""
