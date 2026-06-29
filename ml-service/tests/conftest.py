"""
Purpose:   Shared pytest fixtures: testcontainers Postgres, FastAPI TestClient, DI overrides swapping components for fakes.
Layer:     test
May import:   pytest, testcontainers, FastAPI TestClient, app.main, app.deps, tests.fakes/*
Must NOT import:  (nothing in app/* may import tests/* — tests are leaves)
"""
