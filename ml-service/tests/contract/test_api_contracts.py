"""
Purpose:   Contract: golden request/response per endpoint, all error codes (400/401/413/415/422/429/503), auth rejection.
Layer:     test
May import:   pytest, FastAPI TestClient, app.main, app.schemas/*, tests.fakes/* (via DI override)
Must NOT import:  real google-genai, real sentence-transformers (fakes wired through conftest)
"""
