"""
Purpose:   e5 model load + encode (passage:/query:), threadpool offload + Semaphore(2), LRU(1000) query-embedding cache.
Layer:     component
May import:   app.config, domain/* (types); sentence-transformers, torch, anyio.to_thread, cachetools (the one resource this wraps)
Must NOT import:  services/*, api/*, other components/*
"""
