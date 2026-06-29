"""
Purpose:   APIRouter aggregator for the /api/v1 prefix (mounts ingest, query, vision, health sub-routers).
Layer:     api
May import:   FastAPI (APIRouter), api/v1/* sibling routers
Must NOT import:  components/* or repository directly; domain/* directly; services/* (routers reach services via app.deps)
"""
